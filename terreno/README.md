# Terrain

Terrain analysis by **Julián** (QGIS). All layers use the HiRISE DTM projection: equirectangular Mars sphere (R = 3,396,190 m), central meridian 137.3° E, standard parallel 0°. This is a local QGIS CRS (`USER:100000`), not an EPSG code — see the WKT in the `.prj` files.

## Contents

| Path | Description |
|---|---|
| [`ENTREGA_SIG_Julian/`](ENTREGA_SIG_Julian/) | **Final GIS delivery.** Full documentation (Spanish) in [`ENTREGA_SIG_Julian/README.txt`](ENTREGA_SIG_Julian/README.txt) |
| `ENTREGA_SIG_Julian/01 RUTAS Y PARADAS/` | Area of interest, approved route (`RUTA.2`), candidate intermediate and logistic stops, point buffers |
| `ENTREGA_SIG_Julian/02 RASTERS PROCESADOS/` | 10 m rasters: cleaned DTM, slope (degrees and classes), TPI (30 m), roughness classes, cost matrix |
| `ENTREGA_SIG_Julian/03 VALIDACION/` | Cost matrix sampled every ~10 m along the route, with counts per cost class |
| `ENTREGA_SIG_Julian/04 MAPAS Y DOCUMENTACION/` | QGIS project |
| `ENTREGA_SIG_Julian/MATRIZ DE COSTE GENERAL.tif` | Integrated cost matrix used by the app and the Monte Carlo simulation |
| `entrega_julian/` | First delivery (AOI, routes V and V2), kept for traceability |
| `salidas/` | GeoJSON conversions (lon east 0–360, planetocentric lat) and an overlay check of the routes on the HiRISE ortho image |
| `datos_crudos/` | HiRISE ortho image `PSP_001752_1750_RED_C_01_ORTHO.JP2` (1.01 m/px). **Not in git** (33 MB): download from https://www.uahirise.org/PSP_001752_1750 |

## Method (summary)

1. Clean the HiRISE DTM and resample the analysis grid to 10 m.
2. Derive slope (degrees): 0–15° traversable, 15–20° caution, **> 20° not traversable**.
3. Derive TPI (30 m) and roughness, reclassified into relative classes.
4. Combine slope, TPI and roughness classes into an **ordinal cost matrix from 1 (lowest) to 6 (highest)** with heuristic weights agreed by the team. NoData = no coverage (treated as blocked by the app).
5. Validate along the route: 371 samples, 367 with cost (1: 100, 2: 140, 3: 100, 4: 20, 5: 6, 6: 1) and 4 without a cost value in two sectors. Checked against the slope raster, those samples fall on three 10 m cells with slopes of 21.7–25.2° (above the 20° limit): near −4.8738°, 137.2924° E (P01–P02 segment) and −4.8424 to −4.8426°, 137.3201° E (≈ 250 m from P03). The route crosses them for about 10 m and 20 m. These cells sit on narrow passes through steep ridges: the shortest way around adds about 150 m (P01–P02) and 700 m (P02–P03), so the route was kept and the app flags the three cells on the map ("pass with caution"). Routes the app computes live with A* never enter cells above 20°.

## How the app uses it

[`app/scripts/apply_sig.py`](../app/scripts/apply_sig.py) converts the delivery into the app grid:

- `costo.json` ← `MATRIZ DE COSTE GENERAL.tif` (NoData → blocked).
- `tipos.json` ← terrain types derived from the TPI (ridge, hollow, sand/flat).
- `rutas.json` ← route V2 (= `RUTA.2`) costed with the real matrix.
- `paradas.json` ← stops P01 (base), P02 and P03 on the route, with their terrain type.

## Limitations

The cost classes are relative to this prototype; a 10 m grid cannot resolve small rocks or cracks; the NoData sectors need more data; candidate stops are not certified rest or emergency points. See section 6 of Julián's README.

## `ZONAS.tif` (Julián, Nov 15)

Binary mask on the same 10 m grid and CRS (443 × 402): 1 = zone, 0 = rest. It contains every cell with slope above 20° plus the edge of the analysis area, so it matches the no-go cells already blocked in the cost matrix and in the app. Stored in `ENTREGA_SIG_Julian/02 RASTERS PROCESADOS/`.

## P02 as base (Julián, Nov 15)

`ENTREGA_SIG_Julian/04 MAPAS Y DOCUMENTACION/P02_base_evaluacion.png`: P02 over the cost matrix and the HiRISE orthoimage. Julián's map reports the worst case within a 30 m buffer around P02: slope ≈ 8.0° and relative cost 2/6 (maxima). In the same buffer, the mean slope is 5.8° and most cells have cost 1; at the P02 cell itself the slope is 5.7°. The nearest slope above 20° is 140 m away, and the edge of the analysis area is 113 m to the southeast.
