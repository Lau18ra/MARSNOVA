import {writeFileSync} from 'node:fs';
import {QUESTIONS,createState,summarizeAll} from './model.mjs';
writeFileSync(new URL('./initial-state.json',import.meta.url),JSON.stringify(createState(),null,2));
writeFileSync(new URL('./configuration.json',import.meta.url),JSON.stringify({version:'1.0.0',prior:{alpha:1,beta:1,source:'Supuesto del prototipo, no dato NASA'},questions:QUESTIONS,initialSummaries:summarizeAll(createState())},null,2));
