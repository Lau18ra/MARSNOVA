"""
Agrega a la app las estaciones científicas candidatas del protocolo de ciencia
(ciencia/entrega_juan/stations.json) y las preguntas Q1–Q5 de ese protocolo.

Se corre DESPUÉS de scripts/build_real_data.py y scripts/apply_sig.py:
  - paradas.json        ← quita las paradas provisionales S1/S2 y agrega E1–E5
                          (P01–P05 del protocolo, renombradas para no chocar con
                          las paradas P01–P03 de la ruta). Tipo de terreno e
                          hipótesis según la celda de la grilla.
  - probabilidades.json ← pregunta de cada hipótesis = pregunta Qn del protocolo,
                          con criterios de Sí / No / Inconcluso para el astronauta.
                          Los priors (α = 2, β = 1) no se tocan.

Uso:
  python3 scripts/apply_estaciones.py <carpeta ciencia/entrega_juan> <carpeta app>
"""
import json
import math
import sys
from pathlib import Path

CRITERIOS = {
    "Q1": {"si": "Se ve una discontinuidad (fractura o cresta) que cruza el corredor de ±10 m.",
           "no": "El corredor se ve completo y no hay ninguna discontinuidad.",
           "inconcluso": "No se ve todo el corredor o la observación es de mala calidad."},
    "Q2": {"si": "El indicador de mineral hidratado es claramente mayor en la cresta que en la hondonada.",
           "no": "Es claramente menor en la cresta.",
           "inconcluso": "La diferencia es incierta (su intervalo incluye el cero) o no son comparables."},
    "Q3": {"si": "El horizonte queda por encima del Sol: bloqueo solar en el escenario definido.",
           "no": "El Sol queda claramente por encima del horizonte.",
           "inconcluso": "La diferencia es incierta o falta definir el escenario (fecha y hora)."},
    "Q4": {"si": "La planicie tiene claramente menor amplitud térmica diaria que la hondonada.",
           "no": "La planicie tiene claramente mayor amplitud.",
           "inconcluso": "La diferencia es incierta o las mediciones no son comparables."},
    "Q5": {"si": "El segmento cruza un contacto validado entre unidades sedimentarias distintas.",
           "no": "El segmento queda en una sola unidad, fuera de la incertidumbre de los contactos.",
           "inconcluso": "No se puede validar el contacto."},
}
NO_APLICA = "La pregunta no aplica en este lugar (no cuenta como evidencia)."


def main(juan: Path, app: Path) -> None:
    real = app / "src/data/real"
    tipos = json.loads((real / "tipos.json").read_text())
    costo = json.loads((real / "costo.json").read_text())
    probs_j = json.loads((real / "probabilidades.json").read_text())
    paradas_j = json.loads((real / "paradas.json").read_text())
    stations = json.loads((juan / "stations.json").read_text())
    # Observables por estación (entregable del día 2 de Juan)
    qo_path = juan / "dia2_vistas_orbitales" / "que_observar.json"
    que_obs = json.loads(qo_path.read_text()) if qo_path.exists() else {}

    # Modelo del protocolo: preguntas por hipótesis
    cfg = json.loads((juan / "configuration.json").read_text())
    preguntas = cfg["questions"]  # {"Q1": {"hypothesis": "H1", "text": ...}, ...}
    q_de_h = {q["hypothesis"]: (qid, q) for qid, q in preguntas.items()}

    for h in probs_j["hipotesis"]:
        if h["id"] not in q_de_h:
            continue
        qid, q = q_de_h[h["id"]]
        h["pregunta_id"] = qid
        h["pregunta"] = q["text"]
        h["criterios"] = {**CRITERIOS[qid], "no_aplica": NO_APLICA}
    probs_j["protocolo"] = (
        "Preguntas Q1–Q5 y criterios del protocolo de ciencia del equipo (ciencia/entrega_juan). "
        "La app conserva su motor: Beta(2,1) por hipótesis y tipo de terreno; el protocolo usa Beta(1,1) "
        "como análisis conservador."
    )
    (real / "probabilidades.json").write_text(json.dumps(probs_j, ensure_ascii=False, indent=1))

    o = tipos["origen"]
    R, cm, x0, y0, res = o["radio_m"], o["meridiano_central_E"], o["x_min_m"], o["y_max_m"], o["res_m"]
    W, H = tipos["ancho"], tipos["alto"]
    probs = probs_j["hipotesis"]
    nombres_tipo = {t["id"]: t["nombre"] for t in tipos["tipos"]}

    def pregunta_de(hids):
        qs = [f'{h["pregunta_id"]} ({h["id"]})' for h in probs if h["id"] in hids and h.get("pregunta_id")]
        return ("Esta parada responde " + ", ".join(qs) + ": ver cada pregunta y sus criterios abajo.") if qs else ""

    nuevas = [p for p in paradas_j["paradas"] if p["id"] not in ("S1", "S2") and not p["id"].startswith("E")]
    for p in nuevas:
        if not p.get("es_base") and (not p.get("que_observar") or p["que_observar"].startswith("Pendiente")):
            p["que_observar"] = "Responde las preguntas de abajo según sus criterios de Sí, No, Inconcluso y No aplica."
        if not p.get("es_base"):
            p["pregunta"] = pregunta_de(p["hipotesis"])
    for i, s in enumerate(stations, start=1):
        x = R * math.radians(s["longitude"] - cm)
        y = R * math.radians(s["latitude"])
        col, fila = int((x - x0) // res), int((y0 - y) // res)
        if not (0 <= fila < H and 0 <= col < W):
            raise SystemExit(f"{s['id']} cae fuera de la grilla")
        idx = fila * W + col
        t = int(tipos["celdas"][idx])
        c = costo["celdas"][idx]
        if c == costo["prohibido"]:
            raise SystemExit(f"{s['id']} cae en una celda prohibida")
        hids = [h["id"] for h in probs if str(t) in h["por_tipo"]]
        nuevas.append({
            "id": f"E{i}",
            "nombre": f"E{i} · {s['purpose']}",
            "fila": fila, "col": col, "tipo": t,
            "hipotesis": hids,
            "pregunta": pregunta_de(hids),
            "que_observar": que_obs.get(s["id"]) or (
                f"{s['purpose']} ({nombres_tipo.get(t, t).lower()}). Estación candidata por fotointerpretación; "
                f"a {s['distanceFromStartM']:.0f} m del inicio de la ruta V2."),
            "foto": f"e{i}",  # app/assets/estaciones/e{i}.jpg (vista orbital HiRISE de Juan)
            "x_m": round(x, 4), "y_m": round(y, 4),
            "lat": s["latitude"], "lon_E": s["longitude"],
            "costo_celda": float(c),
            "protocolo_id": s["id"],
        })
    paradas_j["paradas"] = nuevas
    paradas_j["fuente"] = (paradas_j.get("fuente", "") +
                           " Estaciones E1–E5 = estaciones candidatas P01–P05 del protocolo de ciencia (ciencia/entrega_juan).")
    (real / "paradas.json").write_text(json.dumps(paradas_j, ensure_ascii=False, indent=1))
    for p in nuevas:
        print(p["id"], p["nombre"], "tipo", p["tipo"], p["hipotesis"], "costo", p.get("costo_celda"))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
