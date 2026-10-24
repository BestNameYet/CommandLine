'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
function model(){assert.ok(fs.existsSync(__dirname+'/model.cjs'),'model implementation must exist');return require('./model.cjs');}
test('six endpoints have the requested order and dry/wet fractions close',()=>{
 const r=model().simulate();
 assert.equal(r.panels.length,6);
 assert.deepEqual(r.panels.map(p=>p.phase),['end-exhalation','end-inhalation','end-exhalation','end-inhalation','end-exhalation','end-inhalation']);
 for(const p of r.panels){assert.ok(Math.abs(p.dryPercent.reduce((a,b)=>a+b,0)-100)<1e-8);assert.ok(Math.abs(p.wetPercent.reduce((a,b)=>a+b,0)+p.waterPercent-100)<1e-8);assert.ok(p.dryPercent.every(v=>v>=0&&v<=100));}
});
test('zero-exchange zero-deadspace first inspiration matches analytical dilution',()=>{
 const m=model(),r=m.simulate({bloodFlowLMin:0,deadspaceL:0,airwayCells:0}),p=r.panels[1],V=r.config.frcL+ r.config.tidalL;
 assert.ok(Math.abs(p.alveolarVolumeL-V)<1e-10);
 assert.ok(Math.abs(p.dryPercent[2]-100*r.config.tidalL/V)<1e-9);
 assert.ok(Math.abs(p.dryPercent[0]-100*(100/713)*r.config.frcL/V)<1e-9);
});
test('gas conservation closes independently for every species including blood transfer',()=>{
 const r=model().simulate();assert.ok(r.checks.maxMassResidualL<1e-9);
 assert.ok(r.ledger.bloodTransferL[2]>0);assert.ok(r.ledger.bloodTransferL[0]>0);assert.ok(r.ledger.bloodTransferL[1]<0);
});
test('N2O solubility controls uptake and extraction changes lung volume',()=>{
 const m=model(),a=m.simulate(),b=m.simulate({nitrousLambda:0});
 assert.ok(a.ledger.bloodTransferL[2]>b.ledger.bloodTransferL[2]);
 assert.equal(b.ledger.bloodTransferL[2],0);
 assert.ok(a.panels[5].dryPercent[2]<b.panels[5].dryPercent[2]);
 assert.ok(a.panels[5].alveolarVolumeL<b.panels[5].alveolarVolumeL);
});
test('time and airway resolution convergence are numerically small',()=>{
 const m=model(),a=m.simulate(),b=m.simulate({dtSeconds:0.00125}),c=m.simulate({dtSeconds:0.000625});
 const diff=(x,y)=>Math.max(...x.panels.flatMap((p,i)=>p.dryPercent.map((v,j)=>Math.abs(v-y.panels[i].dryPercent[j]))));
 assert.ok(diff(a,b)<0.05);assert.ok(diff(b,c)<=diff(a,b)*0.8+1e-7);
 const d=m.simulate({airwayCells:40,dtSeconds:0.00125});
 assert.ok(diff(b,d)<0.5);
});
test('CO2 pressure-gradient direction reverses and no SpO2 prediction is exported',()=>{
 const m=model();assert.ok(m.exchange([0.14,0.10,0,0.76],m.defaults).gasLPerSecond[1]>0);
 const r=m.simulate();assert.ok(!('SpO2' in r.panels[0]));assert.ok(!('bloodOxygenPercent' in r.panels[0]));
});
test('volume-weighted exhaled fractions and partial pressures are identified correctly',()=>{
 const r=model().simulate();assert.equal(r.panels[0].lastExpiredDryPercent,null);assert.equal(r.panels[1].lastExpiredDryPercent,null);
 assert.ok(Math.abs(r.panels[2].lastExpiredDryPercent.reduce((a,b)=>a+b,0)-100)<1e-8);
 assert.ok(Math.abs(r.panels[0].partialPressureMmHg[0]-100)<1e-10);
 assert.ok(Math.abs(r.panels[0].partialPressureMmHg[1]-40)<1e-10);
});
test('rejects physically invalid mixtures and unstable numerical transport',()=>{
 const m=model();assert.throws(()=>m.simulate({inspired:[1,1,0,0]}));
 assert.throws(()=>m.simulate({dtSeconds:1,airwayCells:40}));
 assert.throws(()=>m.simulate({frcL:0.1,deadspaceL:0.15}));
});
