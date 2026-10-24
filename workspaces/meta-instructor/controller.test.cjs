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
