'use strict';
const defaults={
 pressureMmHg:760,waterMmHg:47,temperatureK:310.15,frcL:2.5,deadspaceL:0.15,tidalL:0.5,periodSeconds:5,
 airwayCells:20,dtSeconds:0.0025,snapshots:6,bloodFlowLMin:5,hemoglobinGdL:15,nitrousLambda:0.47,
 inspired:[0,0,1,0],initialPO2:100,initialPCO2:40,initialVenousPO2:40,initialVenousPCO2:46,
 systemicBloodL:5,aqueousTissueL:41,fatTissueL:14,nitrousWaterLambda:0.47,nitrousFatLambda:1.4,
 oxygenConsumptionLSTPDMin:null,carbonProductionLSTPDMin:0.2,co2BloodSlope:0.2/(5*6),
 tissueO2Beta:2.27e-7,fatO2Beta:10.78e-7,tissueCO2Beta:1.54e-5,fatCO2Beta:1.05e-5
};
const species=['O2','CO2','N2O','other_inert'];
const sum=a=>a.reduce((s,x)=>s+x,0),zero=()=>[0,0,0,0];
function saturation(P){const x=Math.max(0,P),a=x*x*x+150*x;return a/(a+23400);}
function oxygenContent(P,c){return (1.34*c.hemoglobinGdL*saturation(P)+0.0031*P)/100;}
function makeConstants(c){
 const dry=c.pressureMmHg-c.waterMmHg,k=dry/760*273.15/c.temperatureK;
 const o2TissueCapacity=(c.aqueousTissueL*c.tissueO2Beta+c.fatTissueL*c.fatO2Beta)*133.322;
 const co2Capacity=c.systemicBloodL*c.co2BloodSlope+(c.aqueousTissueL*c.tissueCO2Beta+c.fatTissueL*c.fatCO2Beta)*133.322;
 const nitrousCapacity=c.systemicBloodL*c.nitrousLambda+c.aqueousTissueL*c.nitrousWaterLambda+c.fatTissueL*c.nitrousFatLambda;
 const vo2=c.oxygenConsumptionLSTPDMin??c.bloodFlowLMin*(oxygenContent(c.initialPO2,c)-oxygenContent(c.initialVenousPO2,c));
 return {dry,k,o2TissueCapacity,co2Capacity,nitrousCapacity,vo2:vo2/60,vco2:c.carbonProductionLSTPDMin/60};
}
function o2Store(P,c,z){return c.systemicBloodL*oxygenContent(P,c)+z.o2TissueCapacity*P;}
function invertStore(amount,c,z){
 if(amount<0)throw Error('Systemic oxygen store exhausted: model domain exceeded');
 let lo=0,hi=Math.max(c.pressureMmHg,1);
 while(o2Store(hi,c,z)<amount)hi*=2;
 for(let i=0;i<38;i++){const mid=(lo+hi)/2;if(o2Store(mid,c,z)>amount)hi=mid;else lo=mid;}
 return (lo+hi)/2;
}
function exchange(F,c=defaults,venous){
 const z=makeConstants(c),Q=c.bloodFlowLMin/60;
 const p=venous||{oxygenP:c.initialVenousPO2,carbonP:c.initialVenousPCO2,nitrousF:0};
 return {gasLPerSecond:[
 Q*(oxygenContent(F[0]*z.dry,c)-oxygenContent(p.oxygenP,c))/z.k,
 Q*c.co2BloodSlope*(F[1]*z.dry-p.carbonP)/z.k,
 Q*c.nitrousLambda*(F[2]-p.nitrousF),0
 ]};
}
function simulate(options={}){
 const c={...defaults,...options,inspired:[...(options.inspired||defaults.inspired)]},z=makeConstants(c);
 for(const [key,value]of Object.entries(c))if(typeof value==='number'&&!Number.isFinite(value))throw Error('Nonfinite '+key);
 if(c.pressureMmHg<=c.waterMmHg||c.waterMmHg<0||c.temperatureK<=0||c.frcL<=c.deadspaceL||c.deadspaceL<0||c.tidalL<0||c.periodSeconds<=0||c.dtSeconds<=0||!Number.isInteger(c.snapshots)||c.snapshots<1||c.bloodFlowLMin<0||c.nitrousLambda<0||c.systemicBloodL<=0)throw Error('Invalid physical configuration');
 if(c.inspired.length!==4||c.inspired.some(x=>!Number.isFinite(x)||x<0)||Math.abs(sum(c.inspired)-1)>1e-10)throw Error('Inspired dry fractions must sum to one');
 if(c.deadspaceL>0&&(!Number.isInteger(c.airwayCells)||c.airwayCells<1))throw Error('Positive deadspace requires cells');
 if(z.co2Capacity<=0||z.nitrousCapacity<=0||z.vo2<0||z.vco2<0)throw Error('Invalid systemic stores or metabolism');
 const F0=[c.initialPO2/z.dry,c.initialPCO2/z.dry,0,1-(c.initialPO2+c.initialPCO2)/z.dry];
 if(F0.some(x=>x<0))throw Error('Initial gas pressures exceed dry pressure');
 let A=F0.map(x=>x*(c.frcL-c.deadspaceL));
 const cells=c.deadspaceL>0?Array.from({length:c.airwayCells},()=>F0.map(x=>x*c.deadspaceL/c.airwayCells)):[];
 const cellV=cells.length?c.deadspaceL/cells.length:0;
 const body={oxygen:o2Store(c.initialVenousPO2,c,z),carbon:z.co2Capacity*c.initialVenousPCO2,nitrous:0};
 const ledger={inspiredL:zero(),expiredL:zero(),bloodTransferL:zero(),metabolicO2LSTPD:0,metabolicCO2LSTPD:0};
 const totals=()=>A.map((v,i)=>v+sum(cells.map(x=>x[i]))+([body.oxygen/z.k,body.carbon/z.k,body.nitrous,0][i]));
 const initial=totals();let time=0,expired=zero(),expiredVolume=0,lastExpired=null,maxMassResidual=0,minGas=Infinity;
 const panels=[];
 function snap(phase){
  const V=sum(A),F=A.map(x=>x/V),whole=A.map((v,i)=>(v+sum(cells.map(x=>x[i])))/(V+c.deadspaceL));
  panels.push({panel:panels.length+1,timeSeconds:time,phase,alveolarVolumeL:V,totalGasVolumeL:V+c.deadspaceL,
   dryPercent:F.map(x=>100*x),wetPercent:F.map(x=>100*x*z.dry/c.pressureMmHg),waterPercent:100*c.waterMmHg/c.pressureMmHg,
   partialPressureMmHg:F.map(x=>x*z.dry),wholeLungDryPercent:whole.map(x=>100*x),
   lastExpiredDryPercent:lastExpired,systemicVenousPO2:invertStore(body.oxygen,c,z),systemicVenousPCO2:body.carbon/z.co2Capacity,
   systemicVenousNitrousDryFraction:body.nitrous/z.nitrousCapacity});
 }
 snap('end-exhalation');
 for(let half=0;half<c.snapshots-1;half++){
  const inspiration=half%2===0,T=c.periodSeconds/2,n=Math.ceil(T/c.dtSeconds),dt=T/n;
  if(!inspiration){expired=zero();expiredVolume=0;}
  for(let k=0;k<n;k++){
   const a=k/n,b=(k+1)/n,dV=c.tidalL*(Math.cos(Math.PI*a)-Math.cos(Math.PI*b))/2;
   if(cells.length&&dV>cellV)throw Error('Unstable airway transport; reduce dtSeconds or cell count');
   const V=sum(A);if(V<=dV&&!inspiration)throw Error('Expiration exceeds remaining alveolar volume');
   const F=A.map(x=>x/V),old=cells.map(row=>row.map(x=>x/cellV));
   for(let i=0;i<4;i++){
    if(inspiration){
     ledger.inspiredL[i]+=dV*c.inspired[i];
     if(cells.length){for(let j=0;j<cells.length;j++)cells[j][i]+=dV*((j?old[j-1][i]:c.inspired[i])-old[j][i]);A[i]+=dV*old.at(-1)[i];}
     else A[i]+=dV*c.inspired[i];
    }else{
     A[i]-=dV*F[i];
     if(cells.length)for(let j=0;j<cells.length;j++)cells[j][i]+=dV*((j===cells.length-1?F[i]:old[j+1][i])-old[j][i]);
     const out=dV*(cells.length?old[0][i]:F[i]);ledger.expiredL[i]+=out;expired[i]+=out;
    }
   }
   if(!inspiration)expiredVolume+=dV;
   const current=A.map(x=>x/sum(A));
   const venous={oxygenP:invertStore(body.oxygen,c,z),carbonP:body.carbon/z.co2Capacity,nitrousF:body.nitrous/z.nitrousCapacity};
   const U=exchange(current,c,venous).gasLPerSecond;
   for(let i=0;i<4;i++){const d=U[i]*dt;A[i]-=d;ledger.bloodTransferL[i]+=d;}
   body.oxygen+=(z.k*U[0]-z.vo2)*dt;
   body.carbon+=(z.k*U[1]+z.vco2)*dt;
   body.nitrous+=U[2]*dt;
   ledger.metabolicO2LSTPD+=z.vo2*dt;ledger.metabolicCO2LSTPD+=z.vco2*dt;
   minGas=Math.min(minGas,...A,...cells.flat(),body.oxygen,body.carbon,body.nitrous);
   if(minGas < -1e-10||sum(A)<=0)throw Error('Negative gas/store state: refine timestep or check scenario');
   const total=totals();
   const metabolic=[-ledger.metabolicO2LSTPD/z.k,ledger.metabolicCO2LSTPD/z.k,0,0];
   for(let i=0;i<4;i++)maxMassResidual=Math.max(maxMassResidual,Math.abs(total[i]-initial[i]-ledger.inspiredL[i]+ledger.expiredL[i]-metabolic[i]));
  }
  time=(half+1)*T;
  if(!inspiration)lastExpired=expired.map(x=>100*x/expiredVolume);
  snap(inspiration?'end-inhalation':'end-exhalation');
 }
 return {model:'open lung with conducting-airway transport, nonlinear systemic O2 store, buffered CO2 store and recirculating N2O store',
 species,config:c,units:{gasAmounts:'litres at body temperature and dry-gas pressure; water maintained at fixed partial pressure',bodyO2CO2:'litres STPD',dryPercent:'percent of non-water gas',wetPercent:'percent including water'},panels,ledger,
 systemic:{finalBodyOxygenLSTPD:body.oxygen,finalBodyCarbonEquivalentLSTPD:body.carbon,finalBodyNitrousGasEquivalentL:body.nitrous,
 oxygenConsumptionLSTPDMin:z.vo2*60,carbonProductionLSTPDMin:z.vco2*60},
 checks:{maxMassResidualL:maxMassResidual,minGasAmountL:minGas},
 scope:'Approximate well-mixed systemic reservoir and standard blood chemistry, not clinical validation; no individual SpO2 or symptom threshold predicted.'};
}
function output(){
 const baseline=simulate();
 const variants=[['half timestep',{dtSeconds:0.00125}],['double airway resolution',{airwayCells:40,dtSeconds:0.00125}],
 ['smaller systemic blood store',{systemicBloodL:3}],['larger systemic blood store',{systemicBloodL:7}],
 ['lower tidal volume',{tidalL:0.4}],['higher tidal volume',{tidalL:0.6}]];
 const sensitivity=variants.map(([name,config])=>{const r=simulate(config);return {name,lastPanelDryPercent:r.panels.at(-1).dryPercent,
 maxDifferencePercentagePoints:Math.max(...r.panels.flatMap((p,i)=>p.dryPercent.map((v,j)=>Math.abs(v-baseline.panels[i].dryPercent[j]))))};});
 const csv=['panel,phase,time_seconds,alveolar_litres,O2_dry_percent,CO2_dry_percent,N2O_dry_percent,other_dry_percent',
 ...baseline.panels.map(p=>[p.panel,p.phase,p.timeSeconds,p.alveolarVolumeL,...p.dryPercent].join(','))].join('\n');
 return {...baseline,sensitivity,csv};
}
if(require.main===module)console.log(JSON.stringify(output(),null,2));
module.exports={defaults,simulate,exchange,saturation,oxygenContent,output};
