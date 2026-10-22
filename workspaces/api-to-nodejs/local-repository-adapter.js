'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

// Only converts reads of the current, clean Git checkout.
// GitHub-hosted data and non-HEAD refs must retain their remote executor.
function resolveCheckedPath(root,relative=''){
  if(typeof relative!=='string'||path.isAbsolute(relative)||/^[A-Za-z]:/.test(relative)||relative.split(/[\\/]/).some(p=>p==='.'||p==='..'||p===''&&relative!==''))throw Error('Invalid repository path');
  const base=fs.realpathSync(root),parts=relative?relative.split(/[\\/]):[];
  let target=base;
  for(const part of parts){target=path.join(target,part);if(fs.lstatSync(target).isSymbolicLink())throw Error('Symbolic links are not allowed');}
  if(target!==base&&!target.startsWith(base+path.sep))throw Error('Outside repository');
  return {base,target};
}
function git(root,args){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function assertSnapshot(root,ref){
  const head=git(root,['rev-parse','HEAD']);
  if(ref!==undefined&&ref!=='HEAD'&&ref!==head)throw Error('Non-HEAD refs require GitHub API');
  if(git(root,['status','--porcelain','--untracked-files=all']))throw Error('Working tree is not clean; do not substitute checkout for GitHub API');
  return head;
}
function objectSha(buf){return crypto.createHash('sha1').update(Buffer.from('blob '+buf.length+'\0')).update(buf).digest('hex');}
function entry(root,absolute,relative){
  const st=fs.lstatSync(absolute);
  if(st.isSymbolicLink())throw Error('Symbolic links are not allowed');
  if(st.isDirectory())return {name:path.basename(absolute),path:relative,type:'dir',size:0,sha:git(root,['rev-parse','HEAD:'+relative])};
  if(!st.isFile())throw Error('Unsupported filesystem object');
  const data=fs.readFileSync(absolute);
  return {name:path.basename(absolute),path:relative,type:'file',size:data.length,sha:objectSha(data)};
}
function getContent(root,parameters={}){
  if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))throw Error('Invalid parameters');
  if(Object.keys(parameters).some(k=>!['path','ref'].includes(k)))throw Error('Unsupported local parameter');
  const relative=parameters.path===undefined?'':parameters.path;
  const {base,target}=resolveCheckedPath(root,relative);
  assertSnapshot(base,parameters.ref);
  const st=fs.lstatSync(target);
  if(st.isDirectory())return fs.readdirSync(target).sort().map(name=>entry(base,path.join(target,name),relative?relative+'/'+name:name));
  if(!st.isFile())throw Error('Not a file or directory');
  const data=fs.readFileSync(target);
  if(data.length>1024*1024)throw Error('Large content requires GitHub API');
  return {...entry(base,target,relative),encoding:'base64',content:data.toString('base64')+'\n'};
}
function getReadme(root,parameters={}){
  if(Object.keys(parameters).some(k=>k!=='ref'))throw Error('Unsupported local parameter');
  for(const name of ['README.md','README.rst','README.txt','README']) {
    const file=path.join(root,name);
    if(fs.existsSync(file))return getContent(root,{path:name,ref:parameters.ref});
  }
  throw Error('README not found');
}
module.exports={resolveCheckedPath,assertSnapshot,getContent,getReadme};
