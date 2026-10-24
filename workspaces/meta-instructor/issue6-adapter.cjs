'use strict';
const fs=require('node:fs');
const core=require('./controller.cjs');
const INPUT='6358997143',SLOT='<!-- issue6-response-slot:available -->';
async function api(repo,path,method='GET',data) {
 const r=await fetch('https://api.github.com/repos/'+repo+'/'+path,{method,
 headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'},
 body:data===undefined?undefined:JSON.stringify(data)});
 const t=await r.text();if(!r.ok)throw Error('GitHub '+r.status+': '+t.slice(0,300));
 return t?JSON.parse(t):null;
}
async function comments(repo,issue) {
 const all=[];
 for(let page=1;page<=50;page++){
  const rows=await api(repo,'issues/'+issue+'/comments?per_page=100&page='+page);
  all.push(...rows);if(rows.length<100)return all;
 }
 throw Error('Comment pagination limit exceeded');
}
function parseCommand(body) {
 const m=/^gh>\s+meta\s+(start|respond|status)\s+([A-Za-z0-9][A-Za-z0-9_-]{0,79})(?:\s+([1-9][0-9]*))?\s*$/.exec(body);
 if(!m||((m[1]==='status')===Boolean(m[3])))throw Error('Use gh> meta start NONCE TASK_COMMENT_ID, gh> meta respond NONCE RESPONSE_COMMENT_ID, or gh> meta status NONCE');
 return {action:m[1],nonce:m[2],commentId:m[3]};
}
function decodeComment(c,repo) {
 if(c.issue_url!=='https://api.github.com/repos/'+repo+'/issues/7')throw Error('Source must be an Issue 7 comment');
 if(c.user?.login!=='github-actions[bot]'&&c.user?.login!==repo.split('/')[0])throw Error('Source must be owner or command-workflow authored');
 let data=JSON.parse(c.body);
 if(data.type==='gh-command-result'){
  if(data.exitCode!==0)throw Error('Failed command cannot supply application input');
  data=JSON.parse(data.stdout);
 }
 return data;
}
function compactRequest(request) {
 const {context, ...output}=request;
 return output;
}
function appendOutput(previous,nonce,state,receipt) {
 if(previous&&previous.nonce!==nonce)throw Error('Output belongs to a different session');
 const prior=Array.isArray(previous?.outputs)?previous.outputs:
   previous?.request?[{type:'meta-instructor-result',nonce,
     exitCode:0,status:previous.state?.phase==='complete'?'complete':'awaiting-agent',
     errors:[],request:compactRequest(previous.request)}]:[];
 const {sessionCommentId, ...output}=receipt;
 if(output.request)output.request=compactRequest(output.request);
 return {type:'meta-instructor-session',nonce,state,outputs:[...prior,output]};
}
async function main() {
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 const repo=process.env.GITHUB_REPOSITORY;
 if(event.action!=='edited'||event.issue?.number!==6||event.repository?.full_name!==repo||
 String(event.comment?.id)!==INPUT||event.sender?.type==='Bot'||event.sender?.login!==event.repository?.owner?.login)throw Error('Unauthorized application event');
 const live=await api(repo,'issues/comments/'+INPUT);
 if(live.body!==event.comment.body){console.log('Stale event ignored');return;}
 let receipt,outputCommentId=null,previous=null;
 try{
  const cmd=parseCommand(event.comment.body.trim());
  const rows=await comments(repo,7);
  const matches=rows.filter(c=>{
   if(c.user?.login!=='github-actions[bot]')return false;
   try{const v=JSON.parse(c.body);return v.type==='meta-instructor-session'&&v.nonce===cmd.nonce;}catch{return false;}
  });
  if(matches.length>1)throw Error('Duplicate session nonce; inspect state before continuing');
  previous=matches.length?JSON.parse(matches[0].body):null;
  outputCommentId=matches[0]?.id||null;
  let state,errors=[];
  if(cmd.action==='start'){
   if(previous)throw Error('Nonce already exists; use status or choose a fresh nonce');
   const task=decodeComment(await api(repo,'issues/comments/'+cmd.commentId),repo);
   core.validate({type:'object',properties:{problem:{type:'string',minLength:1}},required:['problem'],additionalProperties:false},task);
   state=core.create(task.problem,cmd.nonce);
  }else{
   if(!previous)throw Error('Session not found');
   state=previous.state;
   if(cmd.action==='respond'){
    try{
     const response=decodeComment(await api(repo,'issues/comments/'+cmd.commentId),repo);
     state=core.advance(state,response);
    }catch(e){errors=[e.message];}
   }
  }
  const next=core.request(state);
  receipt={type:'meta-instructor-result',nonce:cmd.nonce,exitCode:errors.length?1:0,
   status:errors.length?'validation-failed':state.phase==='complete'?'complete':'awaiting-agent',
   errors,request:next};
  const body=JSON.stringify(appendOutput(previous,cmd.nonce,state,receipt),null,2);
  // Each nonce selects its own Issue 7 output on start and edits that same ID thereafter.
  const saved=await api(repo,outputCommentId?'issues/comments/'+outputCommentId:'issues/7/comments',
   outputCommentId?'PATCH':'POST',{body});
  outputCommentId=saved.id;
 }catch(e){
  receipt={type:'meta-instructor-result',exitCode:1,status:'failed',errors:[e.message],
   instruction:'Correct the command or source object and retry. No authorization to execute plan steps is granted by this failure.'};
  if(previous&&outputCommentId){
   try{
    const body=JSON.stringify(appendOutput(previous,previous.nonce,previous.state,receipt),null,2);
    await api(repo,'issues/comments/'+outputCommentId,'PATCH',{body});
   }catch(writeError){
    // Preserve the established output ID; surface an unsaved error in Issue 6.
    receipt.errors.push('Unable to update session output: '+writeError.message);
   }
  }else{
   const result=await api(repo,'issues/7/comments','POST',{body:JSON.stringify(receipt,null,2)});
   outputCommentId=result.id;
  }
 }
 const reference={originatorCommentId:Number(INPUT),command:event.comment.body,
  responseCommentId:outputCommentId};
 if(receipt.exitCode)reference.errors=receipt.errors;
 const slots=(await comments(repo,6)).filter(c=>String(c.id)!==INPUT&&c.body===SLOT);
 await api(repo,slots.length?'issues/comments/'+slots[0].id:'issues/6/comments',
  slots.length?'PATCH':'POST',{body:JSON.stringify(reference,null,2)});
 const current=await api(repo,'issues/comments/'+INPUT);
 if(current.body===event.comment.body)await api(repo,'issues/comments/'+INPUT,'PATCH',{body:'gh>'});
 console.log(JSON.stringify({responseCommentId:outputCommentId,exitCode:receipt.exitCode,status:receipt.status}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseCommand,decodeComment,compactRequest,appendOutput};
