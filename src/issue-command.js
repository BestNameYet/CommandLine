'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MARKER='<!-- github-command-surface:v1 -->';
function localStat(root,relative){
 if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'))throw Error('Invalid local path');
 const base=fs.realpathSync(root),target=path.resolve(base,relative);
 if(!target.startsWith(base+path.sep))throw Error('Outside checked-out workspace');
 const real=fs.realpathSync(target);
 if(!real.startsWith(base+path.sep))throw Error('Path resolves outside workspace');
 const stat=fs.lstatSync(target);
 if(stat.isSymbolicLink())throw Error('Symbolic links are not allowed');
 return {path:relative,type:stat.isFile()?'file':stat.isDirectory()?'directory':'other',size:stat.size};
}
function localRead(root,relative,maxBytes=65536){
 if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||/^[A-Za-z]:/.test(relative)||relative.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'))throw Error('Invalid local path');
 const base=fs.realpathSync(root),parts=relative.split(/[\\/]/),target=path.resolve(base,...parts);
 if(!target.startsWith(base+path.sep))throw Error('Outside checked-out workspace');
 let cursor=base;
 for(const part of parts){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Symbolic links are not allowed');}
 const stat=fs.lstatSync(target);
 if(!stat.isFile())throw Error('Expected regular file');
 if(stat.size>maxBytes)throw Error('File exceeds text size limit');
 const fd=fs.openSync(target,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{const actual=fs.fstatSync(fd);if(!actual.isFile()||actual.size>maxBytes)throw Error('File exceeds text size limit or is not regular file');
 const content=fs.readFileSync(fd,{encoding:'utf8'});if(Buffer.byteLength(content,'utf8')>maxBytes)throw Error('File exceeds text size limit');
 return {path:relative,size:actual.size,encoding:'utf8',content};}finally{fs.closeSync(fd);}
}
function requestFor(c,catalog,repository){
 if(c.command.startsWith('issues/')||c.command==='graphql')throw Error('Issue API operations are excluded');
 const op=catalog.commands[c.command];if(!op)throw Error('Unknown command; see command-catalog.json');
 if(/\/issues(?:\/|$)/.test(op.route))throw Error('Issue API operations are excluded');
 const [owner,repo]=repository.split('/'),parameters={...c.parameters};
 for(const p of op.parameters){if(p.in==='path'&&parameters[p.name]===undefined){if(p.name==='owner')parameters.owner=owner;if(p.name==='repo')parameters.repo=repo;}}
 const known=new Set(op.parameters.filter(p=>['path','query'].includes(p.in)).map(p=>p.name));
 for(const k of Object.keys(parameters))if(!known.has(k))throw Error('Unknown parameter: '+k);
 for(const p of op.parameters)if(p.required&&['path','query'].includes(p.in)&&parameters[p.name]===undefined)throw Error('Missing parameter: '+p.name);
 const route=op.route.replace(/\{([^}]+)\}/g,(_,name)=>{
  const v=parameters[name];if(typeof v!=='string'&&typeof v!=='number')throw Error('Invalid path parameter: '+name);
  // Preserve slash-separated API wildcards (contents paths and git refs), encode each component.
  const parts=String(v).split('/');if(parts.some(s=>!s||s==='.'||s==='..'||/[\\\x00-\x1f\x7f]/.test(s)))throw Error('Invalid path parameter: '+name);
  return parts.map(encodeURIComponent).join('/');
 });
 if(!['https://api.github.com','https://uploads.github.com'].includes(op.server))throw Error('Unsupported catalog API origin');
 const url=new URL(op.server+route);
 for(const p of op.parameters.filter(p=>p.in==='query'))if(parameters[p.name]!==undefined){const v=parameters[p.name];if(v!==null&&typeof v==='object'&&!Array.isArray(v))throw Error('Unsupported query object: '+p.name);url.searchParams.set(p.name,Array.isArray(v)?v.join(','):String(v));}
 if(op.bodyRequired&&c.body===undefined&&c.body_base64===undefined)throw Error('Missing request body');
 const headers={};for(const [k,v] of Object.entries(c.headers||{})){if((!/^[a-z0-9-]+$/i.test(k)||['authorization','host','cookie','connection','content-length','transfer-encoding','proxy-authorization'].includes(k.toLowerCase()))||typeof v!=='string'||/[\r\n]/.test(v))throw Error('Unsupported header: '+k);headers[k]=v;}
 if(c.body!==undefined&&c.body_base64!==undefined)throw Error('Choose body or body_base64');
 let body;if(c.body_base64!==undefined){if(typeof c.body_base64!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(c.body_base64))throw Error('Invalid body_base64');if(['GET','HEAD'].includes(op.method))throw Error('This operation does not accept a request body');body=Buffer.from(c.body_base64,'base64');}if(c.body!==undefined){if(['GET','HEAD'].includes(op.method))throw Error('This operation does not accept a request body');if(typeof c.body==='string'){body=c.body;}else{body=JSON.stringify(c.body);if(!Object.keys(headers).some(k=>k.toLowerCase()==='content-type'))headers['Content-Type']='application/json';}}
 return {url:url.href,method:op.method,headers,body};
}
async function call(token,url,options={}){
 return fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(90000),headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...options.headers,Authorization:'Bearer '+token,'User-Agent':'StateMachines-issue-command'}});
}
async function control(token,repo,route,method='GET',body){
 const r=await call(token,'https://api.github.com/repos/'+repo+route,{method,...(body===undefined?{}:{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}})});
 if(!r.ok)throw Error('Control API failed: '+r.status+' '+method+' '+route);
 const data=r.status===204?null:await r.json();
 if((method==='POST'||method==='PATCH')&&/\/issues(?:\/\d+\/comments|\/comments\/\d+)$/.test(route)){
  console.log('issue-comment-published',JSON.stringify({route,method,status:r.status,commentId:data?.id??null,url:data?.html_url??null,requestId:r.headers.get('x-github-request-id')}));
 }
 return data;
}
async function run({command,token,repo,env=process.env}){
 if(!command||typeof command.command!=='string'||!token||!repo)throw Error('Validated command context required');
 let request;
 try{
  if(command.command==='catalog'){
   if(command.parameters!==undefined||command.body!==undefined||command.body_base64!==undefined||command.headers!==undefined)throw Error('catalog accepts no arguments');
   return {result:{command:'catalog',ok:true,status:200,execution:'local'},responseText:fs.readFileSync(path.join(__dirname,'command-catalog.json'),'utf8')};
  }
  if(command.command==='help')return {result:{command:'help',ok:true,status:200},responseText:'Command catalog: src/command-catalog.json'};
  if(command.command==='local/read'){if(!command.parameters||Object.keys(command.parameters).some(k=>k!=='path')||command.body!==undefined||command.body_base64!==undefined||command.headers!==undefined)throw Error('local/read accepts only parameters.path');localRead(env.GITHUB_WORKSPACE||process.cwd(),command.parameters.path);}
  else if(command.command==='local/stat'){if(!command.parameters||Object.keys(command.parameters).some(k=>k!=='path')||command.body!==undefined||command.body_base64!==undefined||command.headers!==undefined)throw Error('local/stat accepts only parameters.path');localStat(env.GITHUB_WORKSPACE||process.cwd(),command.parameters.path);}
  else request=requestFor(command,JSON.parse(fs.readFileSync(path.join(__dirname,'command-catalog.json'),'utf8')),repo);
 }catch(error){return {result:{command:command.command,ok:false,rejected:true,error:error.message},responseText:error.message};}
 try{
  let responseText='',result;
  if(command.command==='local/read'){responseText=JSON.stringify(localRead(env.GITHUB_WORKSPACE||process.cwd(),command.parameters.path));result={command:command.command,ok:true,status:200,execution:'local'};}
  else if(command.command==='local/stat'){responseText=JSON.stringify(localStat(env.GITHUB_WORKSPACE||process.cwd(),command.parameters.path));result={command:command.command,ok:true,status:200,execution:'local'};}
  else{const response=await call(token,request.url,request);responseText=await response.text();result={command:command.command,ok:response.ok,status:response.status};if(!response.ok)result.error=responseText||response.statusText;}
  return {result,responseText};
 }catch(error){return {result:{command:command.command,ok:false,outcome:'unknown',error:error.message},responseText:error.message};}
}
module.exports={MARKER,requestFor,localStat,localRead,control,run};
