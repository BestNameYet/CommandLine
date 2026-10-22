'use strict';
const fs=require('node:fs');
const {control,MARKER}=require('./issue-command.js');
function parse(body){
 const statement=JSON.parse(body.trim());
 if(!statement||Array.isArray(statement)||!Array.isArray(statement.ordinal)||!Array.isArray(statement.statements))throw Error('Expected ordinal and statements arrays');
 const {ordinal,statements}=statement;
 if(!ordinal.length||new Set(ordinal).size!==ordinal.length||ordinal.some(n=>typeof n!=='string'||!n))throw Error('Invalid ordinal');
 const grouped=new Map(ordinal.map(n=>[n,{}]));
 for(const item of statements){
  if(!item||Object.keys(item).sort().join(',')!=='k,nonce,v'||typeof item.k!=='string'||!grouped.has(item.nonce))throw Error('Invalid k/v/nonce entry');
  const group=grouped.get(item.nonce);
  if(Object.hasOwn(group,item.k))throw Error('Duplicate key');
  if(!['command','version','parameters','body','body_base64','headers'].includes(item.k))throw Error('Unsupported key');
  group[item.k]=item.v;
 }
 return ordinal.map(nonce=>{
  const command=grouped.get(nonce);
  if(typeof command.command!=='string'||!command.command)throw Error('Missing command');
  if(command.version!==undefined&&command.version!==1)throw Error('Unsupported version');
  return {nonce,command:{version:1,...command}};
 });
}
async function processEvent(env=process.env){
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const repo=env.GITHUB_REPOSITORY,owner=repo.split('/')[0];
 if(!['created','edited'].includes(event.action)||event.comment?.user?.login?.toLowerCase()!==owner.toLowerCase()||event.issue?.pull_request)return {ignored:true};
 if(env.COMMAND_ISSUE_NUMBER&&String(event.issue.number)!==env.COMMAND_ISSUE_NUMBER)return {ignored:true};
 const token=env.COMMAND_API_TOKEN;
 if(!token)throw Error('Missing command token');
 const comment=await control(token,repo,'/issues/comments/'+event.comment.id);
 if(comment.body!==event.comment.body||comment.user.login.toLowerCase()!==owner.toLowerCase())throw Error('Comment changed');
 if(!comment.body.startsWith(MARKER+'\n'))return {ignored:true};
 let commands;
 try{commands=parse(comment.body.slice(MARKER.length+1));}
 catch(error){await control(token,repo,'/issues/'+event.issue.number+'/comments','POST',{body:'Rejected: '+error.message});return {rejected:true};}
 fs.writeFileSync(env.COMMAND_PARSED_OUTPUT||'parsed-commands.json',JSON.stringify({issue:{number:event.issue.number},comment:{id:event.comment.id},commands}));
 return {accepted:true};
}
if(require.main===module)processEvent().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={parse,processEvent};
