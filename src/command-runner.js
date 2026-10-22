'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {run,control}=require('./issue-command.js');
async function main(env=process.env){
 const payload=JSON.parse(fs.readFileSync(env.COMMAND_PARSED_OUTPUT||'parsed-commands.json','utf8'));
 const token=env.COMMAND_API_TOKEN,repo=env.GITHUB_REPOSITORY;
 if(!token||!repo||!Array.isArray(payload.commands))throw Error('Missing runner context');
 const queue=[];
 for(const {nonce,command} of payload.commands){
  const marker='<!-- command-nonce:'+crypto.createHash('sha256').update(repo+':'+nonce).digest('hex')+' -->';
  let previous=null;
  for(let page=1;;page++){
   const comments=await control(token,repo,'/issues/'+payload.issue.number+'/comments?per_page=100&page='+page);
   previous=comments.find(c=>c.body?.includes(marker));
   if(previous||comments.length<100)break;
  }
  if(previous){queue.push({nonce,marker,command,result:{command:command.command,ok:null,skipped:true},responseText:'Nonce already claimed; command not replayed.'});continue;}
  // The workflow is serialized; claim before side effects to prevent replay.
  await control(token,repo,'/issues/'+payload.issue.number+'/comments','POST',{body:marker+'\nNonce claimed; result pending.'});
  const execution=await run({command,token,repo,env});
  queue.push({nonce,marker,command,...execution});
  if(!execution.result.ok)break;
 }
 fs.writeFileSync(env.COMMAND_RESULT_QUEUE||'result-queue.json',JSON.stringify({issue:payload.issue,comment:payload.comment,results:queue}));
 return queue;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
