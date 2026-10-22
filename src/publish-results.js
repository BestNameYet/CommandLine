'use strict';
const fs=require('node:fs'),path=require('node:path');
const {control}=require('./issue-command.js');
const {renderCommandResult}=require('./render-command.js');
function policy(env,queue){
 const format=env.COMMAND_OUTPUT_FORMAT||'markdown';
 const destination=env.COMMAND_OUTPUT_DESTINATION||'issue';
 if(!['markdown','json','text'].includes(format))throw Error('Unsupported output format');
 if(!['issue','file','stdout'].includes(destination))throw Error('Unsupported output destination');
 const issueNumber=env.COMMAND_OUTPUT_ISSUE?Number(env.COMMAND_OUTPUT_ISSUE):queue.issue.number;
 if(destination==='issue'&&(!Number.isSafeInteger(issueNumber)||issueNumber<1))throw Error('Invalid destination issue');
 const outputPath=env.COMMAND_OUTPUT_PATH||'';
 if(destination==='file'){
  if(!outputPath||!path.isAbsolute(outputPath))throw Error('File output requires an absolute path');
  const workspace=path.resolve(env.RUNNER_TEMP||env.GITHUB_WORKSPACE||process.cwd());
  const target=path.resolve(outputPath);
  if(!target.startsWith(workspace+path.sep))throw Error('File output must remain inside workflow workspace/temp');
 }
 return {format,destination,issueNumber,outputPath};
}
function render(queue,format){
 const entries=queue.results.filter(entry=>!entry.result?.skipped);
 if(format==='json')return [JSON.stringify({issue:queue.issue,comment:queue.comment,results:entries},null,2)];
 if(format==='text')return entries.map(e=>[
  'Nonce: '+e.nonce,
  'Command: '+e.command.command,
  'Outcome: '+(e.result?.ok?'Succeeded':'Failed'),
  'Status: '+(e.result?.status??'unconfirmed'),
  'Response:',String(e.responseText??'')
 ].join('\n'));
 return entries.flatMap(entry=>renderCommandResult({
  issueNumber:queue.issue.number,commentId:queue.comment.id,marker:entry.marker,
  command:entry.command,result:entry.result,responseText:entry.responseText
 }));
}
async function main(env=process.env){
 const queue=JSON.parse(fs.readFileSync(env.COMMAND_RESULT_QUEUE||'result-queue.json','utf8'));
 if(!Array.isArray(queue.results))throw Error('Missing result queue');
 const config=policy(env,queue),parts=render(queue,config.format);
 if(config.destination==='stdout'){for(const part of parts)process.stdout.write(part+'\n');return;}
 if(config.destination==='file'){
  fs.mkdirSync(path.dirname(config.outputPath),{recursive:true});
  fs.writeFileSync(config.outputPath,parts.join('\n\n'),'utf8');return;
 }
 const token=env.COMMAND_API_TOKEN,repo=env.GITHUB_REPOSITORY;
 if(!token||!repo)throw Error('Missing issue publication credentials');
 for(const part of parts)await control(token,repo,'/issues/'+config.issueNumber+'/comments','POST',{body:part});
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main,policy,render};
