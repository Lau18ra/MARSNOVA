"""
Aplica la ENTREGA SIG de Julián (rásteres de 10 m en la misma grilla) a los datos de la app.

Se corre DESPUÉS de scripts/build_real_data.py, que genera la grilla, el AOI, la imagen
de fondo y las paradas P01/P02/P03 sobre V2. Este script reemplaza lo provisional:

  - costo.json   ← MATRIZ DE COSTE GENERAL.tif (escala ordinal 1–6 de Julián).
                   NoData de Julián = prohibido (-1). Dentro del DTM, NoData coincide
                   exactamente con pendiente > 20° (no transitable según el equipo).
  - tipos.json   ← clasificación derivada del TPI de 30 m de Julián:
                   cresta = TPI alto, hondonada = TPI bajo, arena/plano = TPI intermedio y
                   rugosidad baja. (La deriva este script; Julián no entregó tipos.)
  - paradas.json ← tipo e hipótesis de P01–P03 recalculados; S1/S2 provisionales se
                   reubican en celdas transitables del tipo pedido, junto a V2.
  - rutas.json   ← costo de V2 con la matriz real. Las celdas de V2 que la matriz marca
                   como prohibidas se cuentan con el costo máximo (6) y se listan en "alertas".

Uso:
  python3 scripts/apply_sig.py "<carpeta ENTREGA SIG>" <carpeta app marsnova>
Requiere: numpy y Pillow.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

NODATA = -9999.0
PROHIBIDO = -1
COSTO_MAX = 6.0
UMBRAL_PENDIENTE = 20.0


def read_tif(path):
    im = Image.open(path)
    a = np.asarray(im, dtype=np.float64)
    sx, sy = im.tag_v2[33550][:2]
    tp = im.tag_v2[33922]
    return a, (tp[3], tp[4], sx, sy)


def box_mean(a, r):
    p = np.pad(a, r, mode="edge").astype(np.float64)
    c = np.pad(p.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    k = 2 * r + 1
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def main(sig, app):
    sig, app = Path(sig), Path(app)
    real = app / "src/data/real"
    tipos_j = json.loads((real / "tipos.json").read_text())
    costo_j = json.loads((real / "costo.json").read_text())
    paradas_j = json.loads((real / "paradas.json").read_text())
    rutas_j = json.loads((real / "rutas.json").read_text())
    probs = json.loads((real / "probabilidades.json").read_text())["hipotesis"]

    W, H = tipos_j["ancho"], tipos_j["alto"]
    o = tipos_j["origen"]
    aoi = np.array(costo_j["celdas"], dtype=np.float64).reshape(H, W) != PROHIBIDO  # AOI anterior

    rasters = {}
    for key, rel in [
        ("costo", "MATRIZ DE COSTE GENERAL.tif"),
        ("tpi", "02 RASTERS PROCESADOS/TPI.30M.FINAL.tif"),
        ("pend", "02 RASTERS PROCESADOS/PENDIENTE.10M.GRADOS.FINAL.tif"),
        ("rug", "02 RASTERS PROCESADOS/RUGOSIDAD.CLASES.tif"),
        ("dtm", "02 RASTERS PROCESADOS/DTM.AOI.10M.LIMPIO.tif"),
    ]:
        a, (x0, y0, sx, sy) = read_tif(sig / rel)
        if abs(sx - o["res_m"]) > 1e-6 or abs(sy - o["res_m"]) > 1e-6:
            raise SystemExit(f"{rel}: resolución {sx}×{sy}, la app usa {o['res_m']}")
        dc = (x0 - o["x_min_m"]) / o["res_m"]
        dr = (o["y_max_m"] - y0) / o["res_m"]
        if abs(dc - round(dc)) > 1e-3 or abs(dr - round(dr)) > 1e-3:
            raise SystemExit(f"{rel}: no está alineado con la grilla de la app")
        dc, dr = int(round(dc)), int(round(dr))
        g = np.full((H, W), NODATA)
        h, w = min(a.shape[0], H - dr), min(a.shape[1], W - dc)
        g[dr:dr + h, dc:dc + w] = a[:h, :w]
        rasters[key] = g

    c = rasters["costo"]
    valido = (c != NODATA) & aoi
    costo = np.where(valido, c, PROHIBIDO).astype(np.float64)

    # Coherencia: NoData de costo dentro del DTM == pendiente > 20°
    dtm_ok = rasters["dtm"] != NODATA
    nd_en_dtm = dtm_ok & (c == NODATA)
    empinado = rasters["pend"] > UMBRAL_PENDIENTE
    print(f"celdas sin costo dentro del DTM: {int(nd_en_dtm.sum())}; de ellas con pendiente > 20°: {int((nd_en_dtm & empinado).sum())}")

    # Tipos de terreno desde el TPI (suavizado 30 m para formar manchas continuas)
    tpi = rasters["tpi"]
    tpi_ok = tpi != NODATA
    tpi_f = np.where(tpi_ok, tpi, 0.0)
    w_ok = box_mean(tpi_ok.astype(float), 1)
    tpi_s = np.where(w_ok > 0, box_mean(tpi_f, 1) / np.maximum(w_ok, 1e-9), 0.0)
    ref = tpi_ok & valido
    q_hi = float(np.quantile(tpi_s[ref], 0.70))
    q_lo = float(np.quantile(tpi_s[ref], 0.40))
    rug = rasters["rug"]
    tipos_old = np.array(tipos_j["celdas"]).reshape(H, W)
    tipos = np.where(tpi_s >= 0, 0, 1)                      # media: cresta si TPI ≥ 0, si no hondonada
    tipos[tpi_s >= q_hi] = 0                                # cresta: más alto que su entorno
    tipos[tpi_s <= q_lo] = 1                                # hondonada: más bajo que su entorno
    tipos[(tpi_s > q_lo) & (tpi_s < q_hi) & (rug == 1)] = 2  # arena/plano: intermedio y liso
    tipos = np.where(tpi_ok, tipos, tipos_old)              # sin TPI: se conserva lo anterior

    # ---------------- paradas
    def hips_de(t):
        return [h["id"] for h in probs if str(t) in h["por_tipo"]]

    def pregunta_de(hids):
        qs = [h.get("pregunta") for h in probs if h["id"] in hids and h.get("pregunta")]
        return " ".join(qs) if qs else "Pendiente de definir."

    def rc_to_xy(f, col):
        return o["x_min_m"] + (col + 0.5) * o["res_m"], o["y_max_m"] - (f + 0.5) * o["res_m"]

    def to_latlon(x, y):
        R = o["radio_m"]
        return math.degrees(y / R), o["meridiano_central_E"] + math.degrees(x / R)

    camino_v2 = rutas_j["rutas"]["P01-P03"]["camino"]
    tramo_12 = rutas_j["rutas"]["P01-P02"]["camino"]
    tramo_23 = rutas_j["rutas"]["P02-P03"]["camino"]

    def buscar(tramo, tipo_b, max_m=250.0):
        mid = tramo[len(tramo) // 2]
        r = int(max_m / o["res_m"])
        best = None
        for f in range(max(1, mid[0] - r), min(H - 1, mid[0] + r + 1)):
            for col in range(max(1, mid[1] - r), min(W - 1, mid[1] + r + 1)):
                if tipos[f, col] != tipo_b or costo[f, col] == PROHIBIDO:
                    continue
                win_t = tipos[f - 1:f + 2, col - 1:col + 2]
                win_c = costo[f - 1:f + 2, col - 1:col + 2]
                if (win_t == tipo_b).sum() < 7 or (win_c == PROHIBIDO).any():
                    continue
                d = math.hypot(f - mid[0], col - mid[1])
                if best is None or d < best[0]:
                    best = (d, f, col)
        return best

    nuevas = []
    for p in paradas_j["paradas"]:
        if p["id"] in ("S1", "S2"):
            tramo, tipo_b = (tramo_12, 0) if p["id"] == "S1" else (tramo_23, 2)
            b = buscar(tramo, tipo_b)
            if not b:
                print(f"{p['id']}: no encontré celda transitable del tipo {tipo_b}; se omite")
                continue
            _, f, col = b
            x, y = rc_to_xy(f, col)
            lat, lon = to_latlon(x, y)
            p.update({"fila": f, "col": col, "x_m": x, "y_m": y, "lat": round(lat, 5), "lon_E": round(lon, 5)})
        f, col = p["fila"], p["col"]
        t = int(tipos[f, col])
        p["tipo"] = t
        if not p.get("es_base"):
            hids = hips_de(t)
            p["hipotesis"] = hids
            sufijo = " (Parada provisional.)" if p["id"] in ("S1", "S2") else ""
            p["pregunta"] = pregunta_de(hids) + sufijo
        p["pendiente_grados"] = round(float(rasters["pend"][f, col]), 1)
        p["costo_celda"] = float(costo[f, col])
        if costo[f, col] == PROHIBIDO:
            raise SystemExit(f"{p['id']} cae en una celda prohibida (pendiente {p['pendiente_grados']}°)")
        nuevas.append(p)
    paradas_j["paradas"] = nuevas
    paradas_j["fuente"] = "Posiciones de V2 (Julián); tipos desde el TPI de la ENTREGA SIG; hipótesis H1–H5 (Juan David). Base = P02 (mitad de la ruta): toda la ruta queda a menos de 2 km, criterio de NASA para caminatas de Artemis."

    # ---------------- rutas V2 con el costo real
    def costo_ruta(cells):
        s, alertas = 0.0, []
        for (f, col) in cells:
            if costo[f, col] == PROHIBIDO:
                alertas.append({"fila": f, "col": col, "pendiente_grados": round(float(rasters["pend"][f, col]), 1)})
        cv = lambda f, col: COSTO_MAX if costo[f, col] == PROHIBIDO else costo[f, col]
        for (f1, c1), (f2, c2) in zip(cells[:-1], cells[1:]):
            s += (cv(f1, c1) + cv(f2, c2)) / 2 * math.hypot(f2 - f1, c2 - c1)
        return round(float(s), 2), alertas

    for k, r in rutas_j["rutas"].items():
        r["costo"], r["alertas"] = costo_ruta(r["camino"])
    rutas_j["fuente"] = "V2 de Julián (= RUTA.2 de la ENTREGA SIG); costo con MATRIZ DE COSTE GENERAL"

    # ---------------- escribir
    meta = {
        "fuente": "REAL",
        "nota": ("ENTREGA SIG de Julián: matriz de costo ordinal 1–6 (pendiente, TPI y rugosidad). "
                 "Prohibido = pendiente > 20° o sin datos. Tipos de terreno derivados del TPI de 30 m."),
        "orden": tipos_j["orden"],
    }
    tipos_j.update(meta)
    tipos_j["celdas"] = tipos.ravel().astype(int).tolist()
    tipos_j["tpi_umbrales"] = {"cresta_desde": round(q_hi, 3), "hondonada_hasta": round(q_lo, 3)}
    costo_j.update(meta)
    costo_j["escala"] = "ordinal 1 (menor) – 6 (mayor costo relativo)"
    costo_j["celdas"] = [round(float(x), 2) for x in costo.ravel()]

    (real / "tipos.json").write_text(json.dumps(tipos_j))
    (real / "costo.json").write_text(json.dumps(costo_j))
    (real / "paradas.json").write_text(json.dumps(paradas_j, ensure_ascii=False, indent=1))
    (real / "rutas.json").write_text(json.dumps(rutas_j, ensure_ascii=False))

    dentro = valido
    print(f"celdas transitables: {int(dentro.sum())} de {W * H}")
    print("costo transitable 1..6:", [int((costo == v).sum()) for v in range(1, 7)])
    print("tipos en celdas transitables (cresta, hondonada, arena):", [int(((tipos == k) & dentro).sum()) for k in range(3)])
    print(f"TPI: cresta ≥ {q_hi:.3f}, hondonada ≤ {q_lo:.3f}")
    for p in nuevas:
        print(p["id"], p["fila"], p["col"], "tipo", p["tipo"], "costo", p["costo_celda"], "pend", p["pendiente_grados"], p["hipotesis"])
    for k, r in rutas_j["rutas"].items():
        print(k, len(r["camino"]), "celdas, costo", r["costo"], "alertas", r["alertas"])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
