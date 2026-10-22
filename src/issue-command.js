'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MARKER='<!-- github-command-surface:v1 -->';
const {renderCommandResult}=require('./render-command.js');
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
async function run({command,issue,comment,receiptMarker,token,repo,env=process.env}){
 if(!command||typeof command.command!=='string'||!issue||!comment||!receiptMarker||!token||!repo)throw Error('Validated command context required');
 const controlToken=token,apiToken=token;
 let request;
 try{if(command.command==='help'){if(Object.keys(command).some(k=>!['version','command'].includes(k)))throw Error('help takes no arguments');}else if(command.command==='local/test-stat'){if(command.body!==undefined||command.body_base64!==undefined||command.headers!==undefined||Object.keys(command.parameters||{}).length)throw Error('local/test-stat takes no arguments');}else if(command.command==='local/test-read'){if(command.body!==undefined||command.body_base64!==undefined||command.headers!==undefined||Object.keys(command.parameters||{}).length)throw Error('local/test-read takes no arguments');}else if(command.command==='local/read'){if(!command.parameters||Object.keys(command.parameters).some(k=>k!=='path')||command.body!==undefined||command.body_base64!==undefined||command.headers!==undefined)throw Error('local/read accepts only parameters.path');localRead(env.GITHUB_WORKSPACE||process.cwd(),command.parameters.path);}else if(command.command==='local/stat'){if(!command.parameters||Object.keys(command.parameters).some(k=>k!=='path')||command.body!==undefined||command.body_base64!==undefined||command.headers!==undefined)throw Error('local/stat accepts only parameters.path');localStat(env.GITHUB_WORKSPACE||process.cwd(),command.parameters.path);}else request=requestFor(command,JSON.parse(fs.readFileSync(path.join(__dirname,'command-catalog.json'),'utf8')),repo);}
 catch(error){await control(controlToken,repo,'/issues/'+issue.number+'/comments','POST',{body:receiptMarker+'\nRejected: '+error.message});return {rejected:true};}
 if(command.command==='help'){
  const docs='https://github.com/'+repo+'/blob/main/ChatMachines/Workflow%20Interactive%20Procedures/GitHub%20Command%20Issue/';
  await control(controlToken,repo,'/issues/'+issue.number+'/comments','POST',{body:receiptMarker+'\nCommand reference (no API request executed):\n\n- [Command catalog]('+docs+'command-catalog.json)\n- [Command JSON schema]('+docs+'user-issue-command.schema.json)\n- [README and usage]('+docs+'README.md)\n\nUse `{\"version\":1,\"command\":\"repos/get\",\"parameters\":{}}` as a normal command example.'});
  return {help:true};
 }
 const receipt=await control(controlToken,repo,'/issues/'+issue.number+'/comments','POST',{body:receiptMarker+'\nExecuting `'+command.command+'`.'});
 let result, responseText='';
 try{
  // Execute the requested GitHub operation, not a simulated request.
  if(command.command==='local/test-stat'){const stream=require('node:test').run({files:[path.join(__dirname,'local-stat.test.js')]});let passed=0,failed=0;const failures=[];for await(const event of stream){if(event.type==='test:pass')passed++;if(event.type==='test:fail'){failed++;failures.push(String(event.data?.details?.error?.message||event.data?.name||'test failed'));}}responseText=JSON.stringify({passed,failed,failures});result={command:command.command,status:failed?500:200,ok:failed===0,execution:'local'};}else if(command.command==='local/test-read'){const stream=require('node:test').run({files:[path.join(__dirname,'local-read.test.js')]});let passed=0,failed=0;const failures=[];for await(const event of stream){if(event.type==='test:pass')passed++;if(event.type==='test:fail'){failed++;failures.push(String(event.data?.details?.error?.message||event.data?.name||'test failed'));}}responseText=JSON.stringify({passed,failed,failures});result={command:command.command,status:failed?500:200,ok:failed===0,execution:'local'};}else if(command.command==='local/read'){responseText=JSON.stringify(localRead(env.GITHUB_WORKSPACE||process.cwd(),command.parameters.path));result={command:command.command,status:200,ok:true,execution:'local'};}else if(command.command==='local/stat'){responseText=JSON.stringify(localStat(env.GITHUB_WORKSPACE||process.cwd(),command.parameters.path));result={command:command.command,status:200,ok:true,execution:'local'};}else{const r=await call(apiToken,request.url,request);responseText=await r.text();result={command:command.command,status:r.status,ok:r.ok};if(!r.ok)result.error=responseText||r.statusText||'GitHub API request failed';}
 }catch(error){result={command:command.command,ok:false,outcome:'unknown',error:error.message};}
 const summary=result.ok?'Executed `'+command.command+'` (HTTP '+result.status+').':'Failed `'+command.command+'`'+(result.status?' (HTTP '+result.status+')':'')+': '+(result.error||'Unknown outcome');
 await control(controlToken,repo,'/issues/comments/'+receipt.id,'PATCH',{body:receiptMarker+'\n'+summary});
 // Render command output using the adapted AGENTS issue renderer, targeting the event issue.
 const renderedParts=renderCommandResult({issueNumber:issue.number,commentId:comment.id,marker:receiptMarker,command,result,responseText:responseText||result.error||''});
 for(const body of renderedParts){
  await control(controlToken,repo,'/issues/'+issue.number+'/comments','POST',{body});
 }
 if(!result.ok)process.exitCode=1;return result;
}
module.exports={MARKER,requestFor,localStat,localRead,control,run};