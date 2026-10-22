'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {control}=require('./issue-command.js');
const TAG='<!-- github-node-direct:v1 -->';
function parseDirect(body,issue,comment,repo){
 if(!body.startsWith(TAG+'\n'))throw Error('Direct tag missing');
 const x=JSON.parse(body.slice(TAG.length+1).trim());
 if(!x||Array.isArray(x)||typeof x!=='object')throw Error('Invalid request');
 if(typeof x.nonce!=='string'||! /^[A-Za-z0-9_-]{8,128}$/.test(x.nonce))throw Error('Invalid nonce');
 if(typeof x.source!=='string'||!x.source.trim()||Buffer.byteLength(x.source)>50000)throw Error('Invalid source');
 const deps=x.dependencies??[];
 if(!Array.isArray(deps)||deps.length>20||deps.some(d=>typeof d!=='string'||!/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*@[0-9][0-9A-Za-z.+-]*$/.test(d)))throw Error('Dependencies require pinned npm versions');
 const ret=x.return??{};
 if(!ret||Array.isArray(ret)||typeof ret!=='object'||!['issue','file'].includes(ret.destination??'issue')||!['markdown','json','text'].includes(ret.format??'markdown'))throw Error('Invalid return descriptor');
 const args=x.arguments??null;
 if(Buffer.byteLength(JSON.stringify(args))>16384)throw Error('Arguments too large');
 const marker='<!-- command-nonce:'+crypto.createHash('sha256').update(repo+':direct:'+x.nonce).digest('hex')+' -->';
 return {issue:{number:issue},comment:{id:comment},commands:[{nonce:x.nonce,command:{command:'direct/execute'}}],
 nonce:x.nonce,marker,source:x.source,dependencies:deps,arguments:args,return:{destination:ret.destination??'issue',format:ret.format??'markdown'}};
}
async function main(env=process.env){
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8')),repo=env.GITHUB_REPOSITORY,owner=repo.split('/')[0];
 if(event.issue?.pull_request||!['created','edited'].includes(event.action)||event.comment?.user?.login?.toLowerCase()!==owner.toLowerCase())throw Error('Unauthorized event');
 if(env.COMMAND_ISSUE_NUMBER&&String(event.issue.number)!==env.COMMAND_ISSUE_NUMBER)throw Error('Wrong issue scope');
 const remote=await control(env.COMMAND_API_TOKEN,repo,'/issues/comments/'+event.comment.id);
 if(remote.body!==event.comment.body||remote.user.login.toLowerCase()!==owner.toLowerCase())throw Error('Comment changed');
 const parsed=parseDirect(remote.body,event.issue.number,event.comment.id,repo);
 for(let page=1;;page++){
  const list=await control(env.COMMAND_API_TOKEN,repo,'/issues/'+event.issue.number+'/comments?per_page=100&page='+page);
  if(list.some(c=>c.id!==event.comment.id&&c.body?.includes(parsed.marker)))throw Error('Nonce already completed');
  if(list.length<100)break;
 }
 fs.writeFileSync(env.DIRECT_PARSED_OUTPUT,JSON.stringify(parsed));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={TAG,parseDirect,main};
