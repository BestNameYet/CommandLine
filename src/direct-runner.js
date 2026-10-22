'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
function main(env=process.env){
 const x=JSON.parse(fs.readFileSync(env.DIRECT_PARSED_OUTPUT,'utf8'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'node-direct-'));
 fs.writeFileSync(path.join(dir,'entry.cjs'),'globalThis.commandArguments='+JSON.stringify(x.arguments)+';\n'+x.source);
 let install={status:0,stderr:''};
 if(x.dependencies.length)install=cp.spawnSync('npm',['install','--ignore-scripts','--no-audit','--no-fund','--prefix',dir,...x.dependencies],
  {encoding:'utf8',timeout:60000,maxBuffer:262144,env:{PATH:env.PATH,HOME:dir,npm_config_cache:path.join(dir,'.npm')}});
 let exec={status:null,stdout:'',stderr:''};
 if(install.status===0)exec=cp.spawnSync(process.execPath,[path.join(dir,'entry.cjs')],{
  cwd:dir,encoding:'utf8',timeout:60000,maxBuffer:262144,env:{PATH:env.PATH,HOME:dir,DIRECT_ARGUMENTS:JSON.stringify(x.arguments)}});
 const ok=install.status===0&&exec.status===0&&!exec.error;
 const entry={nonce:x.nonce,marker:x.marker,command:{command:'direct/execute'},
  result:{command:'direct/execute',ok,status:ok?200:500,execution:'container',exitCode:exec.status},
  responseText:JSON.stringify({stdout:exec.stdout??'',stderr:(install.stderr??'')+(exec.stderr??''),error:exec.error?.message??install.error?.message??null,exitCode:exec.status})};
 fs.writeFileSync(env.DIRECT_RESULT_OUTPUT,JSON.stringify(entry));
 return entry;
}
if(require.main===module)try{main()}catch(e){console.error(e);process.exitCode=1}
module.exports={main};
