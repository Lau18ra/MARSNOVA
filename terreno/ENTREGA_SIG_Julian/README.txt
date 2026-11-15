README — ENTREGA SIG
Reto: Interplanetary Survival Guide: Martian Map
Área de trabajo: Monte Sharp, cráter Gale, Marte
Fecha de organización: 14 de noviembre de 2026

1. Propósito

Este paquete reúne los datos geográficos y productos SIG preparados para evaluar una ruta preliminar de exploración en Marte. La ruta se apoya en un modelo de elevación HiRISE de resolución nominal de 10 m dentro del área de análisis, índices topográficos y una matriz relativa de costos. El proyecto es un prototipo para apoyar la discusión del equipo; no constituye una certificación de seguridad operacional para una misión humana.

2. Sistema de referencia de coordenadas

SRC de trabajo personalizado en QGIS:
  USER:100000 — Mars Gale HiRISE Equirectangular 137.3E

Parámetros técnicos registrados:
  Cuerpo celeste: Marte
  Proyección: equirectangular (cilíndrica equidistante / Plate Carrée)
  Meridiano central: 137,3° E
  Latitud de referencia: 0°
  Unidades: metros
  Radio esférico configurado: 3 396 190 m
  Ejes: Este (X), Norte (Y)

USER:100000 es un identificador local de QGIS, no un código EPSG global. En otro computador se debe crear o importar la definición WKT del SRC antes de interpretar las capas. No asignar WGS84 a estos datos marcianos. Al abrir el proyecto, revisar si QGIS encuentra todas las fuentes; si no, volver a vincularlas con los archivos de esta entrega.

3. Parámetros y criterios usados

• Resolución de análisis de los rásteres locales: 10 m por píxel, salvo el TPI final, que se identifica como 30 m.
• Pendiente: 0–15° se trató como transitable; >15–20° como precaución; >20° como no transitable según los umbrales aprobados por el equipo.
• Matriz de costo: escala ordinal relativa de 1 (menor costo relativo) a 6 (mayor costo relativo). Los valores sintetizan clases de pendiente, TPI y rugosidad con ponderaciones heurísticas acordadas para el prototipo; no son probabilidades ni una norma NASA.
• NoData: -9999 en los rásteres procesados donde fue configurado. NoData significa ausencia de valor/cobertura y no debe interpretarse como costo 1, transitable o peligroso.
• Ruta: se conserva la ruta aprobada por el equipo. Se decidió no hacer desvíos grandes solo para esquivar cuatro muestras sin datos, que se agrupan en dos sectores.

4. Contenido por carpeta

01 RUTAS Y PARADAS
• AOI_CANDIDATA.gpkg — polígono del área de interés usada para delimitar el análisis.
• RUTA.2.gpkg — ruta aprobada/preliminar de trabajo.
• PARADAS_LOGISTICAS_PROVICIONALES.gpkg — paradas logísticas provisionales. El nombre del archivo conserva la grafía con la que fue guardado.
• PARADAS_INTERMEDIAS_BASE.gpkg — puntos intermedios candidatos; su ubicación es preliminar y requiere revisión del equipo.
• BUFFER.PUNTOS.gpkg — buffers alrededor de puntos para revisión espacial; el radio y su interpretación deben consultarse en los atributos/metadatos del proyecto antes de usarlos como criterio operativo.

02 RASTERS PROCESADOS
• DTM.AOI.10M.LIMPIO.tif — modelo de elevación de terreno limpio, base de los derivados locales.
• PENDIENTE.10M.GRADOS.FINAL.tif — pendiente en grados derivada del DTM limpio.
• PENDIENTE.CLASES.10M.tif — clasificación de pendiente según los umbrales del equipo.
• TPI.30M.FINAL.tif — índice de posición topográfica final, escala nominal de 30 m.
• RUGOSIDAD.CLASES.tif — rugosidad reclasificada en clases relativas.
• MATRIZ.COSTO.10M.tif — superficie integrada de costo relativo, escala 1–6.

03 VALIDACION
• MUESTREO.10.gpkg — puntos de muestreo espaciados aproximadamente cada 10 m sobre la ruta, con el valor de la matriz asociado.
• ESTADISTICA.gpkg — conteo de muestras por valor de costo.

Resultado registrado durante la revisión: 371 muestras en total; 367 con costo y 4 NULL. Entre las 367 válidas, los conteos fueron: costo 1 = 100; 2 = 140; 3 = 100; 4 = 20; 5 = 6; 6 = 1. Los cuatro NULL se observaron cerca de celdas sin información en dos sectores. Se conservan como muestras no evaluadas; no se imputó un costo. La ruta no se modificó para forzar un rodeo amplio.

La frecuencia de muestras describe los puntos consultados sobre la geometría analizada, no una proporción de superficie ni una evaluación médica o de rendimiento de astronautas. Confirmar si la geometría muestreada representa un solo tramo o el recorrido completo de ida y vuelta antes de reportar distancias/cobertura como totales.

04 MAPAS Y DOCUMENTACION
• MARSNOVA_REVISION_CRS_PROTO.qgz — proyecto QGIS del prototipo y configuración de capas. Esta carpeta contiene solo el proyecto QGIS; no incluye una composición de impresión ni mapas exportados, de acuerdo con la decisión del equipo.

5. Flujo de trabajo resumido

1. Se cargaron los datos de terreno e imágenes disponibles para el área de trabajo.
2. Se trabajó en QGIS usando el SRC personalizado marciano indicado arriba.
3. Se preparó un DTM limpio para reducir valores inválidos/no válidos en el análisis.
4. Del DTM se derivó pendiente en grados; se generaron clases de pendiente usando los umbrales acordados.
5. Se prepararon los productos TPI y rugosidad y se expresaron como clases relativas.
6. Se combinaron las clases en una matriz de costo ordinal de 1 a 6.
7. Se muestreó la matriz sobre la ruta con puntos cada 10 m y se resumieron los resultados por clase.
8. Se identificaron cuatro muestras NULL en dos sectores. Se mantuvo la ruta base, registrando esos sectores como sin evaluación por falta de cobertura.

6. Limitaciones y uso responsable

• Las clases de costo son relativas al prototipo y dependen de los datos, resolución y ponderaciones utilizados.
• La resolución de 10 m no permite detectar todos los obstáculos pequeños, rocas, grietas ni condiciones locales del suelo.
• Los sectores NoData necesitan datos adicionales o una revisión independiente; no se deben completar por interpolación sin justificarlo.
• Las paradas intermedias y logísticas son candidatas/provisionales, no puntos certificados para descanso, muestreo o emergencia.
• La longitud de ruta, el tiempo de marcha, carga, movilidad con traje EVA, consumo energético y límites fisiológicos deben validarse por el equipo de misión. No se infieren directamente de la matriz SIG.
• La simbología del proyecto ayuda a visualizar los productos, pero la interpretación debe basarse en los valores y metadatos, no solo en los colores.

7. Recomendaciones para abrir y compartir

1. Abrir MARSNOVA_REVISION_CRS_PROTO.qgz en QGIS.
2. Si alguna capa aparece como fuente no disponible, buscar su archivo dentro de las carpetas 01 y 02 y volver a vincularla.
3. Confirmar el SRC USER:100000 y que el DTM/matriz tengan el tamaño de píxel esperado.
4. Mantener los nombres y archivos juntos. Los GeoPackage (.gpkg) son contenedores; no separar capas internas del archivo.
5. Para usar el paquete en otro equipo, transferir la carpeta completa y comprobar rutas de fuentes, SRC y NoData.

