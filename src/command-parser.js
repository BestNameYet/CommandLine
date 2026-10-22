'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const {run,control}=require('./issue-command.js');
function parse(body){
 const text=body.trim(),match=text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
 const c=JSON.parse(match?match[1]:text);
 if(!c||typeof c!=='object'||Array.isArray(c)||c.version!==1||typeof c.command!=='string')throw Error('Expected {"version":1,"command":"operation/id","parameters":{},"body":{}}');
 if(Object.keys(c).some(k=>!['version','command','parameters','body','body_base64','headers'].includes(k)))throw Error('Unknown command field');
 if(c.parameters!==undefined&&(!c.parameters||typeof c.parameters!=='object'||Array.isArray(c.parameters)))throw Error('parameters must be an object');
 if(c.headers!==undefined&&(!c.headers||typeof c.headers!=='object'||Array.isArray(c.headers)))throw Error('headers must be an object');
 return c;
}

async function processEvent(env=process.env){
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const repo=env.GITHUB_REPOSITORY,owner=repo.split('/')[0];
 if(!['created','edited'].includes(event.action)||event.comment?.user?.type!=='User'||event.comment.user.login.toLowerCase()!==owner.toLowerCase()||event.issue?.pull_request)return {ignored:true};
 const token=env.COMMAND_API_TOKEN;
 if(!token)throw Error('COMMAND_API_TOKEN is required');
 const issue=await control(token,repo,'/issues/'+event.issue.number);
 const comment=await control(token,repo,'/issues/comments/'+event.comment.id);
 if(comment.body!==event.comment.body||comment.user?.type!=='User'||comment.user.login.toLowerCase()!==owner.toLowerCase())throw Error('Comment changed or owner authorization changed; submit a new comment');
 if(!/^<!-- command-scope -->\\s*\\n/.test(comment.body))return {ignored:true};
 const receiptMarker='<!-- github-command-receipt:'+comment.id+':'+crypto.createHash('sha256').update(comment.body).digest('hex')+' -->';
 for(let page=1;;page++){
  const comments=await control(token,repo,'/issues/'+issue.number+'/comments?per_page=100&page='+page);
  if(comments.some(c=>c.user?.type==='Bot'&&c.body?.includes(receiptMarker)))return {duplicate:true};
  if(comments.length<100)break;
 }
 let command;
 try{command=parse(comment.body.replace(/^<!-- command-scope -->\\s*\\n/,''));}
 catch(error){await control(token,repo,'/issues/'+issue.number+'/comments','POST',{body:receiptMarker+'\\nRejected: '+error.message});return {rejected:true};}
 return run({command,issue,comment,receiptMarker,token,repo,env});
}
if(require.main===module)processEvent().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parse,processEvent};
