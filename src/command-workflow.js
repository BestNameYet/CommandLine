'use strict';
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
function main(env=process.env){
 const payload=JSON.parse(fs.readFileSync(env.COMMAND_PARSED_OUTPUT,'utf8'));
 const queue={issue:payload.issue,comment:payload.comment,results:[]};
 const persist=()=>fs.writeFileSync(env.COMMAND_RESULT_QUEUE,JSON.stringify(queue));
 persist();
 for(let i=0;i<payload.commands.length;i++){
  try{fs.rmSync(env.COMMAND_SINGLE_RESULT,{force:true});}catch{}
  const child=spawnSync(process.execPath,[require.resolve('./command-runner.js')],{
   env:{...env,COMMAND_INDEX:String(i)},stdio:'inherit'
  });
  if(fs.existsSync(env.COMMAND_SINGLE_RESULT)){
   const result=JSON.parse(fs.readFileSync(env.COMMAND_SINGLE_RESULT,'utf8'));
   queue.results.push(result);
   persist();
   if(result.result?.ok===false)break;
  }
  if(child.status!==0){
   console.error('Runner halted without a complete successful result at index '+i);
   process.exitCode=1;break;
  }
 }
 return queue;
}
if(require.main===module)try{main();}catch(e){console.error(e);process.exitCode=1;}
module.exports={main};
