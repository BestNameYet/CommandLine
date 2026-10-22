'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {run,control}=require('./issue-command.js');
async function main(env=process.env){
 const payload=JSON.parse(fs.readFileSync(env.COMMAND_PARSED_OUTPUT||'parsed-commands.json','utf8'));
 const index=Number(env.COMMAND_INDEX);
 const token=env.COMMAND_API_TOKEN,repo=env.GITHUB_REPOSITORY;
 if(!token||!repo||!Array.isArray(payload.commands)||!Number.isSafeInteger(index)||index<0||index>=payload.commands.length)throw Error('One valid COMMAND_INDEX and runner context required');
 const {nonce,command}=payload.commands[index];
 const marker='<!-- command-nonce:'+crypto.createHash('sha256').update(repo+':'+nonce).digest('hex')+' -->';
 let previous=null;
 for(let page=1;;page++){
  const comments=await control(token,repo,'/issues/'+payload.issue.number+'/comments?per_page=100&page='+page);
  previous=comments.find(c=>c.body?.includes(marker));
  if(previous||comments.length<100)break;
 }
 let entry;
 if(previous)entry={nonce,marker,command,result:{command:command.command,ok:null,skipped:true},responseText:'Nonce already claimed; command not replayed.'};
 else{
  await control(token,repo,'/issues/'+payload.issue.number+'/comments','POST',{body:marker+'\nNonce claimed; result pending.'});
  const execution=await run({command,token,repo,env});
  entry={nonce,marker,command,...execution};
 }
 const output=env.COMMAND_SINGLE_RESULT;
 if(!output)throw Error('COMMAND_SINGLE_RESULT output path required');
 fs.writeFileSync(output,JSON.stringify(entry));
 return entry;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
