/** MARSNOVA v1.0.0 — ES module, no dependencies. */
export const VERSION = '1.0.0';
export const QUESTIONS = Object.freeze({
 Q1:{hypothesis:'H1',text:'¿Una discontinuidad resuelta intersecta el corredor de ±10 m?',contexts:['cresta','hondonada','arena'],method:'boolean',positive:'Intersección observada',negative:'Ausencia en corredor completamente observable'},
 Q2:{hypothesis:'H2',text:'¿El indicador de mineral hidratado es mayor en la cresta que en la hondonada?',contexts:['par_cresta_hondonada'],method:'difference',quantity:'indicador_cresta − indicador_hondonada'},
 Q3:{hypothesis:'H3',text:'¿El horizonte topográfico bloquea el Sol en el escenario definido?',contexts:['cresta','hondonada','arena','planicie'],method:'difference',quantity:'elevacion_horizonte − elevacion_solar'},
 Q4:{hypothesis:'H4',text:'¿La planicie tiene menor amplitud térmica diaria que la hondonada?',contexts:['par_planicie_hondonada'],method:'difference',quantity:'amplitud_hondonada − amplitud_planicie'},
 Q5:{hypothesis:'H5',text:'¿El segmento cruza un contacto cartografiado entre unidades sedimentarias distintas?',contexts:['cresta','hondonada','arena','planicie'],method:'boolean',positive:'Cruce validado',negative:'Segmento en una unidad fuera de la incertidumbre de contactos'}
});
function requireValue(ok,message){if(!ok)throw new Error(message);}
export function createState(){return {version:VERSION,observations:[],history:[]};}
/** Input interval is a supplied uncertainty interval, not computed from screenshot colors. */
export function classify(questionId,evidence){
 const q=QUESTIONS[questionId];requireValue(q,'Pregunta desconocida');
 requireValue(evidence && typeof evidence==='object','Falta evidence');
 if(evidence.applicable===false)return 'not_applicable';
 if(evidence.qualityPassed!==true)return 'inconclusive';
 if(q.method==='boolean'){
  if(evidence.fullyObservable!==true || typeof evidence.finding!=='boolean')return 'inconclusive';
  return evidence.finding?'yes':'no';
 }
 const ci=evidence.differenceInterval;
 if(!Array.isArray(ci)||ci.length!==2)return 'inconclusive';
 requireValue(ci.every(Number.isFinite)&&ci[0]<=ci[1],'Intervalo inválido');
 if(evidence.comparable!==true)return 'inconclusive';
 return ci[0]>0?'yes':ci[1]<0?'no':'inconclusive';
}
export function upsertObservation(state,input){
 requireValue(state?.version===VERSION,'Versión de estado incompatible');
 const q=QUESTIONS[input.questionId];requireValue(q,'Pregunta desconocida');
 requireValue(q.contexts.includes(input.context),'Contexto no aplicable');
 for(const field of ['id','unitId','source','rationale','reviewer'])requireValue(typeof input[field]==='string'&&input[field].trim(),`Falta ${field}`);
 requireValue(Array.isArray(input.stationIds)&&input.stationIds.length>0&&input.stationIds.every(s=>/^P0[1-5]$/.test(s)),'stationIds inválidos');
 if(q.method==='difference'&&input.evidence?.qualityPassed===true){
  requireValue(typeof input.evidence.units==='string'&&input.evidence.units.trim(),'Indicar unidades del contraste');
  requireValue(typeof input.evidence.intervalMethod==='string'&&input.evidence.intervalMethod.trim(),'Indicar cómo se obtuvo el intervalo');
 }
 if(input.questionId==='Q3'&&input.evidence?.qualityPassed===true)requireValue(typeof input.scenario==='string'&&input.scenario.trim(),'Q3 requiere escenario temporal');
 const response=classify(input.questionId,input.evidence);
 const next=JSON.parse(JSON.stringify(state));
 const old=next.observations.find(x=>x.id===input.id);
 if(old)requireValue(old.questionId===input.questionId&&old.unitId===input.unitId&&old.context===input.context,'Una revisión conserva pregunta, contexto y unidad');
 // Same physical unit cannot count twice for one question, even under another terrain.
 requireValue(!next.observations.some(x=>x.id!==input.id&&x.questionId===input.questionId&&x.unitId===input.unitId),'Unidad duplicada para esta pregunta; revise el registro existente');
 const now=new Date().toISOString();
 next.history.push({at:now,id:input.id,previous:old??null});
 const record={...JSON.parse(JSON.stringify(input)),response,updatedAt:now};
 next.observations=next.observations.filter(x=>x.id!==input.id).concat(record);
 return next;
}
// Integer-shape Beta CDF = binomial upper tail. Log summation avoids factorial overflow.
function logGammaInteger(n){let s=0;for(let k=2;k<n;k++)s+=Math.log(k);return s;}
export function betaCDF(x,a,b){
 requireValue(Number.isInteger(a)&&a>0&&Number.isInteger(b)&&b>0,'Formas Beta enteras positivas requeridas');
 if(x<=0)return 0;if(x>=1)return 1;
 const n=a+b-1;let term=logGammaInteger(n+1)-logGammaInteger(a+1)-logGammaInteger(n-a+1)+a*Math.log(x)+(n-a)*Math.log1p(-x);
 let max=term,scaled=1;
 for(let k=a;k<n;k++){
  term+=Math.log(n-k)-Math.log(k+1)+Math.log(x)-Math.log1p(-x);
  if(term>max){scaled=scaled*Math.exp(max-term)+1;max=term;}else scaled+=Math.exp(term-max);
 }
 return Math.min(1,Math.exp(max)*scaled);
}
export function betaQuantile(p,a,b){requireValue(p>=0&&p<=1,'Probabilidad inválida');if(p===0)return 0;if(p===1)return 1;let lo=0,hi=1;for(let k=0;k<60;k++){const mid=(lo+hi)/2;if(betaCDF(mid,a,b)<p)lo=mid;else hi=mid;}return(lo+hi)/2;}
export function summarize(state,questionId,context){
 requireValue(state?.version===VERSION,'Versión incompatible');requireValue(QUESTIONS[questionId]?.contexts.includes(context),'Pregunta/contexto inválido');
 const obs=state.observations.filter(o=>o.questionId===questionId&&o.context===context);
 const count=r=>obs.filter(o=>o.response===r).length;
 const yes=count('yes'),no=count('no'),inconclusive=count('inconclusive'),notApplicable=count('not_applicable');
 const alpha=1+yes,beta=1+no,total=yes+no+inconclusive;
 return {questionId,context,alpha,beta,mean:alpha/(alpha+beta),credibleInterval95:[betaQuantile(.025,alpha,beta),betaQuantile(.975,alpha,beta)],yes,no,inconclusive,notApplicable,inconclusiveRate:total?inconclusive/total:null,status:yes+no?'updated':'prior_only',label:'Probabilidad de resultado favorable entre observaciones concluyentes'};
}
export function summarizeAll(state){return Object.entries(QUESTIONS).flatMap(([id,q])=>q.contexts.map(c=>summarize(state,id,c)));}
