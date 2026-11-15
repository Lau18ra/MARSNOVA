# MARSNOVA — modelo bayesiano listo para integrar

Versión 1.0.0. JavaScript ES Modules, sin dependencias. Funciona en navegador y Node. Este paquete sustituye la sección del documento anterior titulada «Qué debe hacer Juan»: las preguntas, contextos, priors, fórmulas, reglas de clasificación y código ya están definidos.

## Archivos
- model.mjs: motor y configuración de 5 preguntas / 13 contextos.
- initial-state.json: estado real inicial sin observaciones inventadas.
- stations.json: coordenadas de las cinco estaciones candidatas del equipo.
- configuration.json: preguntas, contextos y prior común exportados.
- test.mjs: pruebas ejecutables con `node test.mjs`.
- integration-example.mjs: ejemplo ejecutable y explícitamente sintético.

## Instalación en la app
Copiar model.mjs y los JSON al proyecto. No requiere instalar paquetes. Importar las funciones, cargar el estado persistido y guardar el nuevo estado después de cada operación. El módulo es funcional: devuelve un estado nuevo y no modifica el anterior. La persistencia, autenticación y permisos de la app permanecen a cargo de su infraestructura existente.

```js
import { createState, upsertObservation, summarizeAll } from './model.mjs';
let state = createState(); // o estado JSON persistido, versión 1.0.0
const cards = summarizeAll(state); // 13 resultados con media e intervalo 95 %
// Al registrar evidencia:
state = upsertObservation(state, observation);
// Persistir state con el mecanismo de la app y refrescar summarizeAll(state).
```

## Qué calcula
Probabilidad de resultado favorable ENTRE observaciones concluyentes comparables. No es probabilidad de verdad de toda H1–H5, ni seguridad de la ruta. Prior Beta(1,1) en todas las filas: media 0,5, intervalo central 95 % [0,025;0,975]. Posterior Beta(1+s,1+f). Inconclusos no alteran la Beta, pero se cuentan y muestran. No aplica se registra aparte. No se necesita entrenar una red ni ejecutar MCMC.

Los parámetros iniciales son una decisión declarada del prototipo, no valores medidos por NASA. Las capturas actuales no se cargan como respuestas concluyentes ni como ensayos independientes. El estado inicial está vacío y listo para registrar evidencia real.

## Preguntas y clasificación implementadas
Q1/H1: discontinuidad resuelta que intersecta el corredor ±10 m. Entrada booleana revisada. No verifica endurecimiento ni obstáculos de 0,5 m.
Q2/H2: indicador hidratado de cresta menos indicador de hondonada. Comparación pareada; una sola actualización por par.
Q3/H3: elevación angular del horizonte local menos elevación solar, en grados y para un escenario temporal definido. Sí significa bloqueo solar geométrico; no modela comunicaciones ni duración de sombra. Usar una definición coherente del disco solar y documentarla en rationale.
Q4/H4: amplitud térmica diaria de hondonada menos amplitud de planicie (K o °C para diferencias). Una capa de inercia térmica no basta como medición de amplitud.
Q5/H5: cruce de un contacto cartografiado entre unidades sedimentarias distintas. Entrada booleana revisada. No verifica causalidad de erosión diferencial.

Q1 y Q5: qualityPassed=true y fullyObservable=true son necesarios para resultado concluyente. finding=true produce yes, finding=false produce no. Sin estos requisitos, inconclusive. Son etiquetas emitidas por un revisor con fuente y justificación, no una detección automática de imágenes.

Q2/Q3/Q4: qualityPassed=true, comparable=true y differenceInterval=[inferior,superior]. Intervalo íntegramente >0 produce yes; íntegramente <0 produce no; si toca o cruza cero produce inconclusive. Se fija así una prueba de dirección de contraste, NO de magnitud práctica o seguridad. No queda un umbral δ por inventar. Se exigen units e intervalMethod para documentar el intervalo. No introducir intervalos estimados del color de una captura. El motor consume resultados analíticos; no calcula espectros, DEM o temperatura desde imágenes.

applicable=false produce not_applicable en cualquier pregunta.

## Contrato de una observación
Campos obligatorios: id, unitId, questionId, context, stationIds (P01…P05), source, rationale, reviewer, evidence. Q3 concluyente requiere scenario. Las preguntas y contextos válidos están en configuration.json.

id: identificador persistente del registro. Reutilizarlo para corregir una etiqueta.
unitId: unidad física independiente; igual para recortes o revisores de un mismo objetivo. El motor rechaza otra observación de la misma pregunta y unidad, aunque cambie el terreno. La independencia espacial requiere criterio científico; no se deduce automáticamente de IDs distintos.
stationIds: ubicación o par de ubicaciones. Un par puede estar dentro de una misma estación; describir ambas superficies en rationale.
source: identificador/enlace del producto y versión. Conservar archivos en el repositorio de evidencias de la app.
scenario: fecha/hora, referencia temporal, altura del observador y modelo, cuando aplique.
evidence: controles de calidad y valor booleano o intervalo numérico según la pregunta.

Una revisión conserva pregunta, contexto y unidad; se almacena el registro anterior en history y se recalcula todo desde los registros vigentes. Si cambia la definición científica, crear una nueva versión del protocolo y no mezclar resultados. Validar las entradas y autorización también en servidor cuando la app tenga backend. Los estados importados deben proceder del almacenamiento confiable de la app.

## Panel para el usuario
Título: «Respaldo observado — Q1», etc.
Texto de media: «Probabilidad estimada de resultado favorable entre observaciones concluyentes».
Mostrar mean*100, credibleInterval95*100, yes, no, inconclusive y notApplicable. Con status=prior_only: «Sin observaciones concluyentes: se muestra el prior del prototipo». inconclusiveRate=null significa sin observaciones aplicables, no 0 %.
No crear umbrales automáticos de validación geológica o seguridad. La clasificación yes/no es de la pregunta acotada; no rotular «H1 demostrada».

## Operatividad y límites
Las 13 filas se mantienen independientes y actualizan por pregunta/contexto. Cinco estaciones no equivalen a cinco ensayos por hipótesis. En Q3, tiempos consecutivos son dependientes: no usar cada segundo como un ensayo independiente. Definir unidades y ventanas representativas; agrupar observaciones correlacionadas antes del conteo.

El muestreo dirigido a lugares interesantes condiciona la interpretación. Un gran porcentaje de inconclusos puede producir sesgo de selección entre los concluyentes. No generalizar el porcentaje a todo Marte.

Estaciones: se conservan los vértices 35,105,165,222,280 del CSV. Son candidatos por fotointerpretación. Longitud este y latitud planetocéntrica asumidas; altitud y transitabilidad sin validar.

## Verificación realizada
Pruebas de Beta uniforme, CDF Beta(3,2) contra polinomio analítico, cuantiles y simetrías numéricas en varios tamaños, actualización de Sí/No/Inconcluso, revisiones sin duplicación, rechazo de unidades duplicadas y clasificación por intervalos. Ejecutar `node test.mjs` después de integrar. El paquete no se ha probado dentro de la app de Laura porque su código no fue proporcionado.

## Referencias
MIT OpenCourseWare, 18.05 (2022), Class 15, Conjugate Priors: Beta and Normal:
https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/mit18_05_s22_lec15.pdf
NASA Mars Trek, contexto de la ruta: https://trek.nasa.gov/mars/
Las fuentes respaldan la formulación estadística o el contexto geológico; los priors y protocolos específicos son decisiones de MARSNOVA.
