'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('./controller.cjs');
const prose = n => Array.from({length:n},(_,i)=>'word'+i).join(' ');
const questions = [{id:'q1',question:'What is the requested outcome?',purpose:'Establish scope',required:true}];
const answer = [{id:'q1',answer:'A source-backed research report',evidence:[]}];
function reply(s,payload) { return m.advance(s,{nonce:s.nonce,requestId:m.request(s).requestId,payload}); }
function planned() {
 let s=m.create('Research models','test-01');
 s=reply(s,questions);s=reply(s,answer);
 s=reply(s,{ready:true,reason:'The scope and deliverables are established.',questions:[]});
 return reply(s,Array.from({length:5},(_,i)=>({id:'s'+i,title:'Stage '+i,action:'Perform activity '+i,explanation:prose(100),expectedEvidence:'A source or artifact reference'})));
}
test('requests context-specific questions first and includes strict return schema',()=>{
 const s=m.create('Research models','test-01'); const r=m.request(s);
 assert.equal(r.phase,'questions');assert.equal(r.returnSchema.additionalProperties,false);
 assert.equal(r.returnSchema.properties.payload.type,'array');
});
test('rejects malformed responses transactionally',()=>{
 const s=m.create('Task','nonce');const before=JSON.stringify(s);
 assert.throws(()=>reply(s,{}));assert.equal(JSON.stringify(s),before);
 assert.throws(()=>m.advance(s,{nonce:'wrong',requestId:m.request(s).requestId,payload:questions}));
});
test('questions and answers become one QA array and sufficiency is explicitly assessed',()=>{
 let s=reply(m.create('Task','nonce'),questions);
 assert.equal(m.request(s).phase,'answers');
 assert.throws(()=>reply(s,[{id:'other',answer:'value',evidence:[]}]));
 s=reply(s,answer);assert.equal(s.qa[0].answer,answer[0].answer);
 assert.equal(m.request(s).phase,'context');
 s=reply(s,{ready:false,reason:'Need delivery format',questions:[{id:'q2',question:'Which format?',purpose:'Delivery',required:true}]});
 assert.equal(m.request(s).phase,'answers');assert.equal(s.qa.length,2);
});
test('enforces five unique steps and 100-word explanation boundary',()=>{
 let s=reply(m.create('Task','nonce'),questions);s=reply(s,answer);
 s=reply(s,{ready:true,reason:'Context sufficient',questions:[]});
 const p=Array.from({length:5},(_,i)=>({id:'s'+i,title:'Stage '+i,action:'Do activity '+i,explanation:prose(100),expectedEvidence:'Reference'}));
 assert.throws(()=>reply(s,p.slice(0,4)));
 const short=structuredClone(p);short[0].explanation=prose(99);assert.throws(()=>reply(s,short));
 const dup=structuredClone(p);dup[1].action=' DO   ACTIVITY 0 ';assert.throws(()=>reply(s,dup));
 assert.equal(reply(s,p).phase,'execute');
});
test('authorizes one step, rejects stale or out-of-order reports, and holds blocked reports',()=>{
 let s=planned();const r=m.request(s);assert.equal(r.authorization.stepId,'s0');
 const report={stepId:'s0',status:'completed',summary:'Finished',evidence:[{reference:'https://example.org/source',observation:'Source reviewed'}],blockers:[]};
 assert.throws(()=>reply(s,{...report,stepId:'s1'}));
 const blocked=reply(s,{...report,status:'blocked',evidence:[],blockers:['Source unavailable']});
 assert.equal(blocked.index,0);assert.equal(m.request(blocked).authorization.stepId,'s0');
 const next=reply(s,report);assert.equal(next.index,1);assert.equal(m.request(next).authorization.stepId,'s1');
 assert.throws(()=>m.advance(next,{nonce:s.nonce,requestId:r.requestId,payload:report}));
 assert.equal(s.index,0);
});
test('full lifecycle gates final report at 500 words',()=>{
 let s=planned();
 for(let i=0;i<5;i++) s=reply(s,{stepId:'s'+i,status:'completed',summary:'Completed stage '+i,evidence:[{reference:'artifact:'+i,observation:'Reviewed artifact'}],blockers:[]});
 assert.equal(s.phase,'report');
 assert.throws(()=>reply(s,{report:prose(499),evidence:[]}));
 s=reply(s,{report:prose(500),evidence:[]});
 assert.equal(s.phase,'complete');assert.equal(m.request(s).returnSchema.type,'null');
 assert.throws(()=>reply(s,null));
});

const {appendOutput,compactRequest} = require('./issue6-adapter.cjs');
test('meta outputs append to a stable per-session record without duplicating context',()=>{
 const state={nonce:'alpha',phase:'questions',plan:[],qa:[]};
 const request={nonce:'alpha',requestId:'alpha:0:questions',phase:'questions',
   instruction:'Supply questions',context:{plan:[],qa:[]},returnSchema:{type:'array'}};
 const first=appendOutput(null,'alpha',state,{type:'meta-instructor-result',nonce:'alpha',
   status:'awaiting-agent',exitCode:0,errors:[],request});
 assert.equal(first.outputs.length,1);
 assert.equal(first.outputs[0].request.context,undefined);
 assert.deepEqual(first.state,state);
 const second=appendOutput(first,'alpha',{...state,phase:'answers'},
   {type:'meta-instructor-result',nonce:'alpha',status:'awaiting-agent',exitCode:0,errors:[],request:{...request,phase:'answers'}});
 assert.equal(second.outputs.length,2);
 assert.equal(second.outputs[0].request.phase,'questions');
 assert.equal(second.outputs[1].request.phase,'answers');
 assert.equal(second.state.phase,'answers');
});
test('separate meta instances never merge their output records',()=>{
 const alpha=appendOutput(null,'alpha',{phase:'questions'},
   {status:'awaiting-agent',request:{context:{secret:'alpha'},phase:'questions'}});
 const beta=appendOutput(null,'beta',{phase:'questions'},
   {status:'awaiting-agent',request:{context:{secret:'beta'},phase:'questions'}});
 assert.equal(alpha.nonce,'alpha'); assert.equal(beta.nonce,'beta');
 assert.notStrictEqual(alpha.outputs,beta.outputs);
 assert.throws(()=>appendOutput(alpha,'beta',{phase:'answers'},{status:'awaiting-agent'}),/different session/);
 assert.equal(compactRequest({instruction:'x',context:{large:'data'}}).context,undefined);
});
test('legacy meta session is migrated into the same output history',()=>{
 const previous={type:'meta-instructor-session',nonce:'existing',state:{phase:'questions'},
  request:{phase:'questions',context:{qa:[{id:'q'}]},requestId:'existing:0:questions'}};
 const result=appendOutput(previous,'existing',{phase:'answers'},
   {type:'meta-instructor-result',status:'awaiting-agent',
    request:{phase:'answers',context:{qa:[{id:'q'}]}}});
 assert.equal(result.outputs.length,2);
 assert.equal(result.outputs[0].request.phase,'questions');
 assert.equal(result.outputs[1].request.phase,'answers');
 assert.equal(result.outputs[0].request.context,undefined);
});
test('invalid response and status outputs append without changing the saved state',()=>{
 const state={nonce:'alpha',phase:'answers',revision:1};
 const first=appendOutput(null,'alpha',state,
   {status:'awaiting-agent',errors:[],request:{phase:'answers'}});
 const rejected=appendOutput(first,'alpha',state,
   {status:'validation-failed',exitCode:1,errors:['invalid schema'],request:{phase:'answers'}});
 const status=appendOutput(rejected,'alpha',state,
   {status:'awaiting-agent',exitCode:0,errors:[],request:{phase:'answers'}});
 assert.deepEqual(status.state,state);
 assert.equal(status.outputs.length,3);
 assert.equal(status.outputs[1].status,'validation-failed');
 assert.equal(status.outputs[2].status,'awaiting-agent');
});

function managedSession(nonce='managed-01'){
 let s=m.create('Verify manager-enforced execution',nonce);
 s=reply(s,questions);s=reply(s,answer);s=reply(s,{ready:true,reason:'Enough context',questions:[]});
 const steps=Array.from({length:5},(_,i)=>({id:'m'+i,title:'Managed step '+i,
  action:'Execute permitted work '+i,explanation:prose(100),expectedEvidence:'Verified receipt'}));
 steps[0].allowedOperations=['issue.read'];steps[0].readOnly=true;
 steps[1].allowedOperations=['issue.comment'];steps[1].readOnly=false;
 return reply(s,steps);
}
function actionFor(s,operation,args){
 const g=m.activeGrant(s);
 return {nonce:g.nonce,generation:g.generation,stepId:g.stepId,revision:g.revision,operation,args};
}
test('managed grants reject future steps, writes under read-only steps, and stale revisions without side effects',()=>{
 const s=managedSession();let sideEffects=0;
 const attempt=a=>{m.assertAction(s,a);sideEffects++;};
 assert.throws(()=>attempt({...actionFor(s,'issue.read',{issueNumber:7}),stepId:'m1'}),/mismatched/);
 assert.throws(()=>attempt(actionFor(s,'issue.comment',{issueNumber:7,body:'write'})),/not permitted/);
 assert.equal(sideEffects,0);
 attempt(actionFor(s,'issue.read',{issueNumber:7}));assert.equal(sideEffects,1);
 const recorded=m.recordAction(s,actionFor(s,'issue.read',{issueNumber:7}),{success:true,reference:'https://github.com/BestNameYet/CommandLine/issues/7'},9001);
 assert.throws(()=>m.assertAction(recorded.state,actionFor(s,'issue.read',{issueNumber:7})),/Stale/);
});
test('step receipts are checked before unlocking next step, and pause is enforced',()=>{
 let s=managedSession();
 const act=actionFor(s,'issue.read',{issueNumber:7});
 const saved=m.recordAction(s,act,{success:true,reference:'issue:7',result:{number:7}},9002);s=saved.state;
 const report={stepId:'m0',status:'completed',summary:'Issue read',evidence:[{reference:'receipt:'+saved.receipt.id,observation:'Issue returned'}],blockers:[]};
 assert.throws(()=>reply(s,report),/Pause/);
 s=m.pause(s);
 assert.equal(m.request(s).authorization.okayToContinue,false);
 assert.throws(()=>m.assertAction(s,actionFor(saved.state,'issue.read',{issueNumber:7})),/No active/);
 assert.throws(()=>reply(s,{...report,evidence:[{reference:'receipt:other-task:0:9002',observation:'Wrong receipt'}]}),/matching/);
 s=reply(s,report);assert.equal(s.index,1);assert.equal(m.request(s).authorization.stepId,'m1');
 assert.equal(m.request(s).ui.permittedOperations[0],'issue.comment');
});
test('failed managed actions do not satisfy completion; blocked reports permit corrective resume',()=>{
 let s=managedSession();
 const a=actionFor(s,'issue.read',{issueNumber:7});
 const {state,receipt}=m.recordAction(s,a,{success:false,error:'GitHub refused'},9003);s=m.pause(state);
 assert.throws(()=>reply(s,{stepId:'m0',status:'completed',summary:'done',evidence:[{reference:'receipt:'+receipt.id,observation:'failed'}],blockers:[]}),/successful/);
 s=reply(s,{stepId:'m0',status:'blocked',summary:'API error',evidence:[],blockers:['GitHub refused']});
 assert.equal(s.index,0);const rev=s.revision;
 s=m.resume(s);assert.equal(s.gate,'active');assert.ok(s.revision>rev);
 assert.throws(()=>m.assertAction(s,a),/Stale/);
});
test('user corrections supersede prior plans, invalidate grants, preserve history and isolate sessions',()=>{
 const first=managedSession('first-01'),second=managedSession('second-01');
 const oldAction=actionFor(first,'issue.read',{issueNumber:7});
 const changed=m.revise(first,{problem:'Revised scope',reason:'Updated user requirements',restartAt:'plan'});
 assert.equal(changed.generation,1);assert.equal(changed.phase,'plan');
 assert.equal(changed.history.length,1);assert.equal(changed.history[0].status,'superseded');
 assert.throws(()=>m.assertAction(changed,oldAction),/No active/);
 assert.equal(second.generation,0);assert.equal(second.phase,'execute');
 assert.throws(()=>m.assertAction(second,oldAction),/mismatched/);
 const restart=m.revise(first,{problem:'New questions',reason:'Scope completely changed',restartAt:'questions'});
 assert.equal(restart.phase,'questions');assert.equal(restart.qa.length,0);
});
test('new meta command verbs and compact active instructions are exposed',()=>{
 const {parseCommand}=require('./issue6-adapter.cjs');
 assert.equal(parseCommand('gh> meta action example-1 55').action,'action');
 assert.equal(parseCommand('gh> meta revise example-1 55').action,'revise');
 assert.equal(parseCommand('gh> meta pause example-1').action,'pause');
 assert.equal(parseCommand('gh> meta resume example-1').action,'resume');
 assert.throws(()=>parseCommand('gh> meta action example-1'));
 const s=managedSession();
 const r=m.request(s);
 assert.deepEqual(r.ui.permittedOperations,['issue.read']);
 assert.equal(r.authorization.grant.nonce,s.nonce);
 assert.equal(r.ui.gate,'active');
});
