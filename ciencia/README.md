# Science protocol

Scientific hypotheses, field questions and candidate stations by **Juan David Cifuentes Rivera**.

## Contents

| Path | Description |
|---|---|
| `entrega_juan/entregable_dia1_juancifuentes.pdf` | Day-1 deliverable: hypotheses H1–H5 for the Mount Sharp boxwork zone |
| `entrega_juan/model.mjs` | Evidence protocol engine (JavaScript, no dependencies): 5 questions (Q1–Q5) × 13 contexts, Beta(1,1) prior |
| `entrega_juan/configuration.json` | Questions, contexts and prior exported from the engine |
| `entrega_juan/stations.json` | 5 candidate science stations along route V2 (photo-interpretation) |
| `entrega_juan/test.mjs` | Tests — run `node test.mjs` (all pass) |
| `entrega_juan/LEEME_LAURA.md` | Integration notes and interpretation rules (Spanish) |

## Questions

| Q | Hypothesis | Question |
|---|---|---|
| Q1 | H1 | Does a resolved discontinuity intersect the ±10 m corridor? |
| Q2 | H2 | Is the hydrated-mineral indicator higher on the ridge than in the hollow? |
| Q3 | H3 | Does the topographic horizon block the Sun in the defined scenario? |
| Q4 | H4 | Does the plain have a smaller daily thermal amplitude than the hollow? |
| Q5 | H5 | Does the segment cross a mapped contact between different sedimentary units? |

## How the app uses it

[`app/scripts/apply_estaciones.py`](../app/scripts/apply_estaciones.py) brings the protocol into the app:

- The 5 candidate stations become stops **E1–E5** (renamed from P01–P05 to avoid clashing with route stops P01–P03). They replace the provisional stops S1/S2. All are within 1.4 km of the base (P02).
- Each hypothesis shows its question Qn and the field criteria for *Yes / No / Inconclusive / Not applicable*.
- *Not applicable* was added to the app: like *Inconclusive*, it does not change the Beta and is counted separately.
- Results are worded as in the protocol: "observed support", "estimated probability of a favorable result among conclusive observations", never "hypothesis proven".

## Two models, on purpose

| | App (field use) | Protocol (review) |
|---|---|---|
| Prior | Beta(2, 1) — weak prior so each observation visibly moves the map (advisor's recommendation) | Beta(1, 1) — uniform, conservative analysis |
| Unit | Hypothesis × terrain type, painted on the map | Question × context (13 independent rows) |
| Input | Astronaut's quick answer | Reviewer's structured evidence (source, rationale, interval) |

The app is what the astronaut uses in the field; the protocol defines how a reviewer validates that evidence. The Monte Carlo simulation (`montecarlo/`) was run with the app model and the earlier stop set (before E1–E5 were added).

## Limits (from the protocol)

Five stations are not five independent trials per hypothesis; targeted sampling of interesting places conditions the interpretation; a high share of inconclusive answers can bias the conclusive ones. Stations are candidates from photo-interpretation; altitude and traversability are not validated.

## Day 2: orbital views of the stations (`entrega_juan/dia2_vistas_orbitales/`)

- `vista_orbital_5_paradas.png`: one panel per candidate station P01–P05 (E1–E5 in the app), with coordinates, distance from the route start and a ~100 m scale bar. Crops of the Curiosity HiRISE mosaic in NASA Mars Trek (NASA/JPL/University of Arizona). Geological labels are still provisional.
- `point1.jpg`–`point5.jpg`: wider context views (≈ 1.2 km across); the yellow mark is the station. In `point3.jpg` the second mark (lower left) is station P02.
- The app shows `point1–5` as the reference image of stations E1–E5 (`app/assets/estaciones/`).
- `entregable_dia2_juancifuentes.pdf` → `que_observar.json`: what to observe at each station and the criteria for it. The app shows it in each station's "Qué observar" field.
