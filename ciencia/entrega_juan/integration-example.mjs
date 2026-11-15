// DEMOSTRACIÓN SINTÉTICA. No importar este registro como evidencia de la ruta.
import {createState,upsertObservation,summarize} from './model.mjs';
let state=createState();
state=upsertObservation(state,{
 id:'DEMO-001',unitId:'DEMO-PAIR-001',questionId:'Q2',context:'par_cresta_hondonada',stationIds:['P02'],
 source:'SIMULADO: no producto NASA',reviewer:'Demostración',rationale:'Ejemplo de contrato con intervalo de contraste positivo.',
 evidence:{qualityPassed:true,comparable:true,differenceInterval:[0.01,0.03],units:'indicador adimensional',intervalMethod:'Intervalo ficticio para demostrar la API'}
});
console.log(summarize(state,'Q2','par_cresta_hondonada'));
