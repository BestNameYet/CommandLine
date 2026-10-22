'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {run,control}=require('./issue-command.js');
async function main(env=process.env){
 const payload=JSON.parse(fs.readFileSync(env.COMMAND_PARSED_OUTPUT||'parsed-commands.json','utf8'));
 const token=env.COMMAND_API_TOKEN,repo=env.GITHUB_REPOSITORY;
 if(!token||!repo||!Array.isArray(payload.commands))throw Error('Missing runner context');
 for(const {nonce,command} of payload.commands){
  const marker='<!-- command-nonce:'+crypto.createHash('sha256').update(repo+':'+nonce).digest('hex')+' -->';
  let seen=false;
  for(let page=1;;page++){
   const comments=await control(token,repo,'/issues/'+payload.issue.number+'/comments?per_page=100&page='+page);
   if(comments.some(c=>c.body?.includes(marker))){seen=true;break;}
   if(comments.length<100)break;
  }
  if(seen){console.log('Skipped duplicate nonce',nonce);continue;}
  // Claim the nonce before execution. A failed/unknown operation must not be replayed automatically.
  await control(token,repo,'/issues/'+payload.issue.number+'/comments','POST',{body:marker+'\nClaimed nonce '+nonce});
  await run({command,issue:payload.issue,comment:payload.comment,receiptMarker:marker,token,repo,env});
  if(process.exitCode)break;
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
