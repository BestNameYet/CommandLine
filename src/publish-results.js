'use strict';
const fs=require('node:fs');
const {control}=require('./issue-command.js');
const {renderCommandResult}=require('./render-command.js');
async function main(env=process.env){
 const queue=JSON.parse(fs.readFileSync(env.COMMAND_RESULT_QUEUE||'result-queue.json','utf8'));
 const token=env.COMMAND_API_TOKEN,repo=env.GITHUB_REPOSITORY;
 if(!token||!repo||!Array.isArray(queue.results))throw Error('Missing result queue context');
 for(const entry of queue.results){
  if(entry.result?.skipped)continue;
  const parts=renderCommandResult({issueNumber:queue.issue.number,commentId:queue.comment.id,marker:entry.marker,command:entry.command,result:entry.result,responseText:entry.responseText});
  for(const body of parts)await control(token,repo,'/issues/'+queue.issue.number+'/comments','POST',{body});
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
