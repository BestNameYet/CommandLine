'use strict';
// Dependency-free controller. JSON Schema uses x-minWords, enforced below.
const text = {type:'string',minLength:1};
const arr = items => ({type:'array',items,maxItems:50});
const obj = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const evidence = arr(obj({reference:text,observation:text}));
const question = obj({id:text,question:text,purpose:text,required:{type:'boolean'}});
const questions = {...arr(question),minItems:1,maxItems:30};
const managedOperations=['issue.read','comment.read','repository.read','issue.comment'];
const stepBase=obj({id:text,title:text,action:text,explanation:{...text,'x-minWords':100},expectedEvidence:text});
const step={...stepBase,properties:{...stepBase.properties,
 allowedOperations:{type:'array',items:{type:'string',enum:managedOperations}},
 readOnly:{type:'boolean'}}};
const schemas = {
 questions,
 answers: arr(obj({id:text,answer:text,evidence})),
 context:obj({ready:{type:'boolean'},reason:text,questions:{...arr(question),maxItems:30}}),
 plan:{...arr(step),minItems:5},
 report:obj({report:{...text,'x-minWords':500},evidence})
};
function words(s) {
 return [...new Intl.Segmenter('en',{granularity:'word'}).segment(s)].filter(x=>x.isWordLike).length;
}
function validate(s,v,path='$') {
 if (s.const !== undefined && v !== s.const) throw Error(path+': unexpected value');
 if(s.type==='null') {if(v!==null)throw Error(path+': expected null');return;}
 if(s.type==='array') {
  if(!Array.isArray(v))throw Error(path+': expected array');
  if(v.length<(s.minItems||0)||v.length>(s.maxItems??Infinity))throw Error(path+': invalid item count');
  v.forEach((x,i)=>validate(s.items,x,path+'['+i+']'));return;
 }
 if(s.type==='object') {
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error(path+': expected object');
  for(const key of s.required||[])if(!Object.hasOwn(v,key))throw Error(path+'.'+key+': required');
  for(const key of Object.keys(v)) {
   if(!Object.hasOwn(s.properties,key))throw Error(path+'.'+key+': unknown field');
   validate(s.properties[key],v[key],path+'.'+key);
  } return;
 }
 if(typeof v!==s.type)throw Error(path+': expected '+s.type);
 if(s.type==='string') {
  if(v.trim().length<(s.minLength||0))throw Error(path+': empty text');
  if(s['x-minWords']&&words(v)<s['x-minWords'])throw Error(path+': requires at least '+s['x-minWords']+' words');
 }
 if(s.enum&&!s.enum.includes(v))throw Error(path+': invalid option');
}
const normalize = s => s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
function unique(items,key) {
 const seen=new Set();
 for(const x of items){const k=normalize(x[key]);if(seen.has(k))throw Error('Duplicate '+key+': '+x[key]);seen.add(k);}
}
function create(problem,nonce) {
 if(typeof problem!=='string'||!problem.trim()||problem.length>12000)throw Error('Problem must contain 1-12000 characters');
 if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(nonce))throw Error('Invalid nonce');
 return {version:1,nonce,problem,phase:'questions',revision:0,generation:0,round:0,qa:[],plan:[],index:0,reports:[],receipts:[],gate:'active',history:[],contextDecisions:[],final:null};
}
function request(s) {
 let payloadSchema=schemas[s.phase],instruction='',authorization={okayToContinue:false,stepId:null};
 switch(s.phase){
 case 'questions':instruction='Return a JSON array of context-specific questions necessary or useful to solve this problem. Explain the purpose of each and mark whether required. Do not execute the task.';break;
 case 'answers':
  payloadSchema={...schemas.answers,minItems:s.qa.filter(q=>q.answer===null).length,maxItems:s.qa.filter(q=>q.answer===null).length};
  instruction='Answer every unanswered question in the QA array by its exact ID. Research available context. State uncertainties explicitly and include evidence references. Do not execute the plan.';break;
 case 'context':instruction='Assess whether the collected answers establish enough context. If gaps remain return ready=false and new context-specific questions with fresh IDs. Otherwise ready=true and an empty questions array. Explain the decision.';break;
 case 'plan':instruction='Return at least FIVE distinct actionable steps, each with at least 100 words of explanation. Include allowedOperations for actions to be mediated by the manager (issue.read, comment.read, repository.read, issue.comment) and readOnly=true for read-only steps. Unlisted operations are not authorized. Unsupported external tools cannot be mediated. Do not execute yet.';break;
 case 'execute':
  payloadSchema=obj({stepId:{type:'string',const:s.plan[s.index].id},status:{type:'string',enum:['completed','blocked']},summary:text,evidence,blockers:arr(text)});
  authorization={okayToContinue:s.gate!=='awaiting-report',stepId:s.plan[s.index].id,
   grant:s.gate==='awaiting-report'?null:activeGrant(s),gate:s.gate||'active'};
  instruction=s.gate==='awaiting-report'?
   'Execution is paused. No further managed tool action is authorized. Report the current step using this schema. Cite matching receipt:<id> references when managed actions were required. A blocked report holds this step; use meta resume for authorized corrective actions.':
   'Only the current step is authorized. For managed tools submit an Issue 7 action JSON and use gh> meta action NONCE COMMENT_ID; verify its receipt. Use gh> meta pause NONCE when finished before reporting. Do not execute future steps. External tool paths are not controlled by this manager.';break;
 case 'report':instruction='All plan steps have accepted completion reports. Return a final report of at least 500 words describing results, evidence, limitations and unfinished issues. Do not claim unsupported results.';break;
 case 'complete':payloadSchema={type:'null'};instruction='Session complete. No further response is accepted.';break;
 default:throw Error('Unknown phase');
 }
 const requestId=s.nonce+':'+s.revision+':'+s.phase;
 return {application:'meta-instructor',nonce:s.nonce,requestId,phase:s.phase,instruction,authorization,
 context:{problem:s.problem,qa:s.qa,contextDecisions:s.contextDecisions,plan:s.plan,currentStep:s.phase==='execute'?s.plan[s.index]:null,reports:s.reports,
 receipts:s.receipts||[],history:s.history||[]},
 ui:{phase:s.phase,step:s.phase==='execute'?s.plan[s.index].id:null,
   gate:s.phase==='execute'?(s.gate||'active'):null,
   permittedOperations:s.phase==='execute'&&s.gate!=='awaiting-report'?(s.plan[s.index].allowedOperations||[]):[],
   next:s.phase==='execute'?(s.gate==='awaiting-report'?'submit current step report':'perform authorized action or pause current step'):
     s.phase==='complete'?'none':'submit response to current schema'},
 returnSchema:s.phase==='complete'?{type:'null'}:obj({nonce:{type:'string',const:s.nonce},requestId:{type:'string',const:requestId},payload:payloadSchema}),
 validationNotes:'x-minWords is controller enforced. Managed receipts attest only mediated operations, not the truth of all agent conclusions. External ChatGPT/browser tools are not intercepted. IDs are structurally unique, not semantically verified.'};
}
function advance(current,response) {
 if(current.phase==='complete')throw Error('Session already complete');
 validate(request(current).returnSchema,response);
 const s=structuredClone(current),p=response.payload;
 switch(s.phase){
 case 'questions':
  unique(p,'id');unique(p,'question');
  s.qa=p.map(q=>({...q,answer:null,evidence:[]}));s.phase='answers';break;
 case 'answers': {
  unique(p,'id');
  const missing=s.qa.filter(q=>q.answer===null);
  if(p.some(a=>!missing.some(q=>q.id===a.id)))throw Error('Answer IDs must match unanswered questions exactly');
  for(const a of p){const q=s.qa.find(q=>q.id===a.id);q.answer=a.answer;q.evidence=a.evidence;}
  s.phase='context';break;
 }
 case 'context':
  if(p.ready&&p.questions.length)throw Error('Ready assessment must have no unanswered questions');
  if(!p.ready&&!p.questions.length)throw Error('Insufficient context requires follow-up questions');
  s.contextDecisions.push(p);
  if(p.ready){s.phase='plan';break;}
  if(++s.round>8)throw Error('Context round limit reached; narrow the task or start a revised session');
  unique(p.questions,'id');unique(p.questions,'question');
  for(const q of p.questions){
   if(s.qa.some(old=>normalize(old.id)===normalize(q.id)||normalize(old.question)===normalize(q.question)))throw Error('Follow-up question repeats an existing ID or question');
   s.qa.push({...q,answer:null,evidence:[]});
  }
  if(s.qa.length>100)throw Error('Too many context questions');
  s.phase='answers';break;
 case 'plan':
  for(const key of ['id','title','action'])unique(p,key);
  for(const item of p){if(item.allowedOperations&&new Set(item.allowedOperations).size!==item.allowedOperations.length)throw Error('Duplicate permitted operation');if(item.readOnly&&item.allowedOperations?.includes('issue.comment'))throw Error('Read-only step cannot permit write');}
  s.plan=p;s.phase='execute';s.gate='active';break;
 case 'execute':
  if(p.status==='completed'&&(!p.evidence.length||p.blockers.length))throw Error('Completion requires evidence and no blockers');
  if((s.plan[s.index].allowedOperations||[]).length){
   if(s.gate!=='awaiting-report')throw Error('Pause managed execution before reporting');
   if(p.status==='completed'){
    const receipts=(s.receipts||[]).filter(r=>r.generation===s.generation&&r.stepId===p.stepId&&r.success);
    if(!receipts.length||!p.evidence.some(e=>receipts.some(r=>e.reference==='receipt:'+r.id)))
     throw Error('Completed managed step needs a matching successful executor receipt');
    for(const e of p.evidence.filter(x=>x.reference.startsWith('receipt:')))
     if(!receipts.some(r=>'receipt:'+r.id===e.reference))throw Error('Receipt is stale, failed, or belongs to another step');
   }
  }
  if(p.status==='blocked'&&!p.blockers.length)throw Error('Blocked report requires blockers');
  s.reports.push(p);
  if(p.status==='completed'){s.gate='active';if(++s.index===s.plan.length)s.phase='report';}
  if(s.reports.length>150)throw Error('Report limit reached');
  break;
 case 'report':s.final=p;s.phase='complete';break;
 }
 s.revision++;
 return s;
}
// Grants are checked against the persisted controller state at the trusted executor boundary.
// A grant is an opaque-to-the-agent state locator, NOT a secret bearer credential.
function activeGrant(s){
 if(s.phase!=='execute'||s.index>=s.plan.length||s.gate==='awaiting-report')return null;
 const step=s.plan[s.index];
 return {nonce:s.nonce,generation:s.generation||0,stepId:step.id,revision:s.revision,
  operations:step.allowedOperations||[],readOnly:step.readOnly===true};
}
function assertAction(s,a){
 const g=activeGrant(s);
 if(!g)throw Error('No active execution grant (paused or wrong phase)');
 if(!a||a.nonce!==g.nonce||a.generation!==(s.generation||0)||a.stepId!==g.stepId||a.revision!==g.revision)
  throw Error('Stale or mismatched session/step/revision grant');
 if(!g.operations.includes(a.operation))throw Error('Operation not permitted by current step');
 if(g.readOnly&&a.operation==='issue.comment')throw Error('Read-only step cannot write');
 if(!a.args||typeof a.args!=='object'||Array.isArray(a.args))throw Error('Action args must be an object');
}
function recordAction(state,action,outcome,sourceCommentId){
 assertAction(state,action);
 if(!Number.isSafeInteger(Number(sourceCommentId))||Number(sourceCommentId)<=0)throw Error('Invalid source comment');
 const s=structuredClone(state);
 const id=s.nonce+':'+(s.generation||0)+':'+sourceCommentId;
 if(s.receipts.some(r=>r.id===id))throw Error('Duplicate action receipt');
 const receipt={id,nonce:s.nonce,generation:s.generation||0,stepId:s.plan[s.index].id,
  revision:s.revision,operation:action.operation,sourceCommentId:Number(sourceCommentId),
  success:outcome.success===true,reference:outcome.reference||null,
  result:outcome.result||null,error:outcome.error||null};
 s.receipts.push(receipt);s.revision++;return {state:s,receipt};
}
function pause(state){
 if(state.phase!=='execute'||state.gate==='awaiting-report')throw Error('No active step to pause');
 const s=structuredClone(state);s.gate='awaiting-report';s.revision++;return s;
}
function resume(state){
 if(state.phase!=='execute'||state.gate!=='awaiting-report'||
   !state.reports.some(r=>r.stepId===state.plan[state.index].id&&r.status==='blocked'))
  throw Error('Only a blocked current step can be resumed for corrective actions');
 const s=structuredClone(state);s.gate='active';s.revision++;return s;
}
function revise(state,change){
 validate({type:'object',properties:{problem:text,reason:text,
  restartAt:{type:'string',enum:['questions','plan']}},required:['problem','reason','restartAt'],additionalProperties:false},change);
 if(state.phase==='complete')throw Error('Completed session is immutable; start a new nonce');
 if(change.restartAt==='plan'&&(!state.qa.length||state.qa.some(q=>q.answer===null)))
  throw Error('Cannot return to planning without completed QA');
 const s=structuredClone(state);
 s.history.push({status:'superseded',generation:s.generation||0,revision:s.revision,
  reason:change.reason,problem:s.problem,qa:s.qa,plan:s.plan,reports:s.reports,receipts:s.receipts});
 s.generation=(s.generation||0)+1;s.problem=change.problem;
 if(change.restartAt==='questions'){s.qa=[];s.contextDecisions=[];s.round=0;}
 s.plan=[];s.index=0;s.reports=[];s.receipts=[];s.final=null;s.gate='active';
 s.phase=change.restartAt==='questions'?'questions':'plan';s.revision++;return s;
}
module.exports={create,request,advance,validate,words,activeGrant,assertAction,recordAction,pause,resume,revise,managedOperations};
