# Clima de la zona de trabajo — MARSNOVA

Condiciones ambientales del monte Sharp (cráter Gale), en la zona del DTM HiRISE:
latitud −4,9488° a −4,7206°, longitud 137,2390° E a 137,3539° E (centro −4,8347°, 137,2964° E).

## Carpetas

| Carpeta | Contenido |
|---|---|
| `datos_crudos/MCD/` | Archivos `.nc` de la Mars Climate Database v6.2 por escenario: MY24, MY25, MY26, cold, warm, strm |
| `datos_crudos/MCD_web/` | Descargas de la interfaz web de la MCD (texto y figura), escenario climatológico, a 2 m del suelo, un dato por hora: A (temperatura, presión, viento, hielo de CO₂), B (nubes de hielo, densidad), C (radiación solar y térmica), D (distancia al Sol, ángulo cenital, polvo, ozono) |
| `datos_crudos/MOLA/` | Mosaico de elevación MOLA MEGDR 128 px/° (para corregir la presión por altura) |
| `matlab/` | Scripts de procesamiento |
| `salidas/json/` | Resultados en JSON (los que usa la app) |
| `salidas/figuras/` | Figuras para revisar y para el pitch |
| `borradores/` | Pruebas iniciales que ya no se usan |

## Orden para correr los scripts

1. `dem_gale.m` → `salidas/json/elevacion_zona.json` (factor de corrección de presión) y `salidas/figuras/mola_gale_zona.png`
2. `mcd_condiciones.m` → `salidas/json/condiciones_<escenario>.json` y figuras de ciclo diario y comparación
3. `escenarios_app.m` → `salidas/json/escenarios.json` (resumen por mes para la app)
4. `mcd_web.m` → `salidas/json/climatologia_web.json` (ciclo hora a hora de la web MCD)

Los scripts encuentran la carpeta `clima` solos (a partir de su propia ubicación), así que funcionan aunque se mueva la carpeta.

## Qué usa la app

Copiar a `marsnova/src/data/real/`:
- `escenarios.json`: escenarios por mes (años MY24–26, rango cold/warm y alerta de tormenta).
- `climatologia_web.json`: promedio climatológico hora a hora (base de la vista "Promedio" y de la ventana de caminata).

## Notas

- La presión de los `.nc` corresponde a la elevación media de la celda del modelo; se corrige con `factor_presion` (≈ 1,23) de `dem_gale.m`. La web MCD confirma la corrección (mínimos de presión dentro de unos pocos Pa).
- Los `.nc` tienen un dato cada 2 h: por eso `hora_tsurf_max` y `horas_luz` salen constantes en `escenarios.json`.
- `tau_ciclo` en `mcd_condiciones.m` escala la opacidad con la presión sin corregir; con la presión corregida sería ≈ 23 % mayor (pendiente de decidir).
- Hielo de CO₂ en superficie = 0 en todos los escenarios: no hay escarcha de CO₂. "Water ice column" de la web es hielo en nubes, no escarcha.
- `climatologia_web.json` se generó la primera vez con un script equivalente en Python; al correr `mcd_web.m` se regenera con el mismo formato (14 variables, 4 cifras significativas).
- C y D son radiación solar y térmica (luz e infrarrojo), no radiación ionizante: la dosis para el astronauta (RAD de Curiosity) sigue pendiente.
