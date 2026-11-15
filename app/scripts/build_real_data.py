"""
Genera los datos de la zona REAL para la app MARSNOVA a partir de la entrega de Julián.

Entradas (carpeta entregaJulian):
  - AOI_CANDIDATA.gpkg                      área de trabajo (polígono)
  - V2.shp (o "V2 (1).shp") + V2.dbf        ruta oficial en dos tramos: P01-P02 y P02-P03
  - PSP_001752_1750_RED_C_01_ORTHO.JP2      imagen HiRISE ortorrectificada (GeoJP2)

Proyección de todo: cilíndrica equidistante, esfera de Marte R = 3 396 190 m,
meridiano central 137,3° E, paralelo estándar 0° (de V2.prj).

Salidas (carpeta de la app src/data/real/ y src/map/):
  - tipos.json   grilla de 10 m sobre el AOI con una clasificación PROVISIONAL
                 (brillo relativo y textura de la imagen; NO es la clasificación de Julián)
  - costo.json   costo PROVISIONAL por tipo de terreno; fuera del AOI = prohibido (-1)
  - paradas.json P01 (base, inicio), P02 y P03, en los extremos y la unión de V2
  - rutas.json   V2 como rutas precalculadas (P01-P02, P02-P03 y P01-P03)
  - src/map/baseImage.ts   imagen HiRISE recortada a la grilla (JPEG en base64)

Cuando Julián entregue la clasificación y la matriz de costo como rásteres
sobre esta misma grilla, se reemplazan tipos.json y costo.json.

Uso:
  python3 scripts/build_real_data.py <carpeta_entregaJulian> <carpeta_app_marsnova>
Requiere: numpy y Pillow (con soporte JPEG 2000).
"""
import base64
import io
import json
import math
import sqlite3
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

R = 3396190.0
CM = 137.3
RES = 10.0  # m por celda (resolución de las rutas de Julián)
PROHIBIDO = -1
TIPOS = [
    {"id": 0, "nombre": "Cresta", "color": "#E8B04B"},
    {"id": 1, "nombre": "Hondonada", "color": "#7A4B3A"},
    {"id": 2, "nombre": "Arena", "color": "#C98B5A"},
]
COSTO_TIPO = [2.0, 1.0, 1.6]  # ilustrativo, igual que en los datos de prueba


# ---------------------------------------------------------------- lectura
def read_aoi(path):
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    table = con.execute("select table_name from gpkg_contents where data_type='features'").fetchone()[0]
    g = con.execute(f'select geometry from "{table}"').fetchone()[0]
    env = (g[3] >> 1) & 7
    w = g[8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]:]
    bo = "<" if w[0] == 1 else ">"
    gtype = struct.unpack(bo + "I", w[1:5])[0]
    o = 5
    if gtype == 6:  # MultiPolygon: tomar el primer polígono
        o += 4 + 1 + 4
    nrings = struct.unpack(bo + "I", w[o:o + 4])[0]
    o += 4
    n = struct.unpack(bo + "I", w[o:o + 4])[0]
    o += 4
    ring = [struct.unpack(bo + "2d", w[o + 16 * i:o + 16 * i + 16]) for i in range(n)]
    return ring


def read_polylines(path):
    d = Path(path).read_bytes()
    off, out = 100, []
    while off < len(d):
        _, cl = struct.unpack(">ii", d[off:off + 8])
        c = d[off + 8:off + 8 + cl * 2]
        if struct.unpack("<i", c[:4])[0] == 3:
            nparts, npts = struct.unpack("<ii", c[36:44])
            p0 = 44 + 4 * nparts
            out.append([struct.unpack("<2d", c[p0 + 16 * i:p0 + 16 * i + 16]) for i in range(npts)])
        off += 8 + cl * 2
    return out


def read_geojp2(path):
    """Escala y punto de amarre del GeoTIFF embebido en el JP2."""
    head = Path(path).read_bytes()[:4096]
    i = head.find(b"uuid")
    t = head[i + 4 + 16:]
    bo = "<" if t[:2] == b"II" else ">"
    off = struct.unpack(bo + "I", t[4:8])[0]
    n = struct.unpack(bo + "H", t[off:off + 2])[0]
    tags = {}
    for k in range(n):
        e = t[off + 2 + 12 * k:off + 14 + 12 * k]
        tag, typ, cnt = struct.unpack(bo + "HHI", e[:8])
        if typ == 12:
            p = struct.unpack(bo + "I", e[8:12])[0]
            tags[tag] = struct.unpack(bo + "d" * cnt, t[p:p + 8 * cnt])
    sx = tags[0x830E][0]
    tp = tags[0x8482]
    return sx, tp[3], tp[4]


# ---------------------------------------------------------------- utilidades
def point_in_poly(xs, ys, poly):
    inside = np.zeros(xs.shape, dtype=bool)
    for (x1, y1), (x2, y2) in zip(poly[:-1], poly[1:]):
        cond = (y1 > ys) != (y2 > ys)
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = (x2 - x1) * (ys - y1) / (y2 - y1) + x1
        inside ^= cond & (xs < xint)
    return inside


def box_mean(a, r):
    """Media en una ventana cuadrada de lado 2r+1 (bordes replicados)."""
    p = np.pad(a, r, mode="edge").astype(np.float64)
    c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)))
    k = 2 * r + 1
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return s / (k * k)


def to_latlon(x, y):
    return math.degrees(y / R), CM + math.degrees(x / R)


# ---------------------------------------------------------------- principal
def main(src, app):
    src, app = Path(src), Path(app)
    aoi = read_aoi(src / "AOI_CANDIDATA.gpkg")
    shp = src / "V2.shp" if (src / "V2.shp").exists() else src / "V2 (1).shp"
    tramos = read_polylines(shp)

    # Paradas: la unión de los dos tramos es P02; P01 y P03 son los extremos libres.
    ends = [tuple(t[0]) for t in tramos] + [tuple(t[-1]) for t in tramos]
    union = max(set(ends), key=ends.count)
    libres = [e for e in ends if e != union]
    p01 = min(libres, key=lambda p: p[0])  # el extremo oeste (tramo P01-P02 de la tabla)
    p03 = max(libres, key=lambda p: p[0])
    p02 = union

    # Grilla de 10 m alineada con los vértices de V2 (centros de celda en esos vértices)
    ox = p02[0] % RES - RES / 2  # borde de celda
    oy = p02[1] % RES - RES / 2
    xs_a = [p[0] for p in aoi]
    ys_a = [p[1] for p in aoi]
    x_min = math.floor((min(xs_a) - ox) / RES) * RES + ox
    x_max = math.ceil((max(xs_a) - ox) / RES) * RES + ox
    y_min = math.floor((min(ys_a) - oy) / RES) * RES + oy
    y_max = math.ceil((max(ys_a) - oy) / RES) * RES + oy
    ancho = int(round((x_max - x_min) / RES))
    alto = int(round((y_max - y_min) / RES))
    cx = x_min + (np.arange(ancho) + 0.5) * RES
    cy = y_max - (np.arange(alto) + 0.5) * RES
    CX, CY = np.meshgrid(cx, cy)
    dentro = point_in_poly(CX, CY, aoi)

    def cell(p):
        return int(round((y_max - p[1]) / RES - 0.5)), int(round((p[0] - x_min) / RES - 0.5))

    # Imagen HiRISE recortada exactamente a la grilla
    jp2 = src / "PSP_001752_1750_RED_C_01_ORTHO.JP2"
    sx, tx, ty = read_geojp2(jp2)
    im = Image.open(jp2)
    im.reduce = 1  # 2 m/píxel aprox.; suficiente para 10 m
    im.load()
    s2 = sx * 2
    box = ((x_min - tx) / s2, (ty - y_max) / s2, (x_max - tx) / s2, (ty - y_min) / s2)
    crop = im.transform((int(round(ancho * RES / 2)), int(round(alto * RES / 2))), Image.EXTENT, box, Image.BILINEAR)
    g = np.asarray(crop, dtype=np.float64)

    # Brillo medio y textura por celda de 10 m (5x5 píxeles de 2 m)
    h5, w5 = (g.shape[0] // 5) * 5, (g.shape[1] // 5) * 5
    blocks = g[:h5, :w5].reshape(h5 // 5, 5, w5 // 5, 5)
    bri = blocks.mean(axis=(1, 3))[:alto, :ancho]
    tex = blocks.std(axis=(1, 3))[:alto, :ancho]

    # Clasificación PROVISIONAL: brillo relativo (como un TPI sobre el brillo, ventana 150 m)
    rel = box_mean(bri - box_mean(bri, 7), 1)  # suavizado 30 m para formar manchas continuas
    tex = box_mean(tex, 1)
    v = dentro
    q_hi = np.quantile(rel[v], 0.70)
    q_lo = np.quantile(rel[v], 0.40)
    t_lo = np.quantile(tex[v], 0.35)
    tipos = np.ones((alto, ancho), dtype=np.int64)  # hondonada por defecto
    tipos[rel >= q_hi] = 0  # cresta: más brillante que su entorno
    tipos[(rel < q_lo) & (tex <= t_lo)] = 2  # arena: más oscura y lisa
    costo = np.array(COSTO_TIPO)[tipos]
    costo[~dentro] = PROHIBIDO

    # Paradas sobre celdas válidas
    real_probs = app / "src/data/real/probabilidades.json"
    probs = json.loads((real_probs if real_probs.exists() else app / "src/data/prueba/probabilidades.json").read_text())["hipotesis"]
    def pregunta_de(hids):
        qs = [h.get("pregunta") for h in probs if h["id"] in hids and h.get("pregunta")]
        return " ".join(qs) if qs else "PRUEBA – pregunta científica pendiente."
    paradas = []
    for pid, nombre, p, base in [
        ("P02", "P02 · base (mitad de la ruta)", p02, True),
        ("P01", "P01 · extremo suroeste", p01, False),
        ("P03", "P03 · fin del tramo (extremo noreste)", p03, False),
    ]:
        f, c = cell(p)
        t = int(tipos[f, c])
        lat, lon = to_latlon(*p)
        hids = [] if base else [h["id"] for h in probs if str(t) in h["por_tipo"]]
        paradas.append({
            "id": pid, "nombre": nombre, "fila": f, "col": c, "tipo": t,
            "hipotesis": hids,
            "pregunta": "Punto de partida y regreso." if base else pregunta_de(hids),
            "que_observar": "" if base else "Pendiente de definir.",
            "foto": None, "x_m": p[0], "y_m": p[1], "lat": round(lat, 5), "lon_E": round(lon, 5),
            **({"es_base": True} if base else {}),
        })
        if costo[f, c] == PROHIBIDO:
            raise SystemExit(f"{pid} cae fuera del AOI")

    # Paradas PROVISIONALES de otros tipos de terreno junto a V2, para que la demo pueda
    # mostrar el aprendizaje en crestas y arena (Juan David define las paradas reales).
    def cerca_de_ruta(tramo, tipo_buscado, max_m=200.0):
        mid = tramo[len(tramo) // 2]
        fm, cm = cell(mid)
        best = None
        r = int(max_m / RES)
        for f in range(max(0, fm - r), min(alto, fm + r + 1)):
            for c in range(max(0, cm - r), min(ancho, cm + r + 1)):
                if tipos[f, c] != tipo_buscado or not dentro[f, c]:
                    continue
                # que la celda sea parte de una mancha del mismo tipo (no un píxel suelto)
                win = tipos[max(0, f - 1):f + 2, max(0, c - 1):c + 2]
                if (win == tipo_buscado).sum() < 7:
                    continue
                d = math.hypot(f - fm, c - cm)
                if best is None or d < best[0]:
                    best = (d, f, c)
        return best

    extra = []
    for pid, nombre, tramo, tipo_b in [
        ("S1", "PRUEBA – Cresta junto a V2", tramos[0], 0),
        ("S2", "PRUEBA – Arena junto a V2", tramos[1], 2),
    ]:
        b = cerca_de_ruta(tramo, tipo_b)
        if not b:
            continue
        _, f, c = b
        x, y = float(cx[c]), float(cy[f])
        lat, lon = to_latlon(x, y)
        extra.append({
            "id": pid, "nombre": nombre, "fila": f, "col": c, "tipo": tipo_b,
            "hipotesis": [h["id"] for h in probs if str(tipo_b) in h["por_tipo"]],
            "pregunta": pregunta_de([h["id"] for h in probs if str(tipo_b) in h["por_tipo"]]) + " (Parada provisional.)",
            "que_observar": "Pendiente de definir.",
            "foto": None, "x_m": x, "y_m": y, "lat": round(lat, 5), "lon_E": round(lon, 5),
        })
    paradas += extra

    # Rutas precalculadas: V2, orientadas P01 -> P02 -> P03
    def tramo_cells(pts, a, b):
        pts = list(pts)
        if math.dist(pts[0], a) > math.dist(pts[-1], a):
            pts.reverse()
        out = []
        for p in pts:
            fc = list(cell(p))
            if not out or out[-1] != fc:
                out.append(fc)
        return out

    t12 = next(t for t in tramos if p01 in (tuple(t[0]), tuple(t[-1])))
    t23 = next(t for t in tramos if p03 in (tuple(t[0]), tuple(t[-1])))
    c12 = tramo_cells(t12, p01, p02)
    c23 = tramo_cells(t23, p02, p03)

    def path_cost(cells):
        s = 0.0
        for (f1, c1), (f2, c2) in zip(cells[:-1], cells[1:]):
            s += (costo[f1, c1] + costo[f2, c2]) / 2 * math.hypot(f2 - f1, c2 - c1)
        return round(float(s), 2)

    rutas = {
        "P01-P02": {"camino": c12, "costo": path_cost(c12), "nombre": "V2 tramo P01-P02"},
        "P02-P03": {"camino": c23, "costo": path_cost(c23), "nombre": "V2 tramo P02-P03"},
        "P01-P03": {"camino": c12 + c23[1:], "costo": path_cost(c12 + c23[1:]), "nombre": "V2 completa"},
    }

    origen = {
        "descripcion": "Cilíndrica equidistante, esfera de Marte R = 3 396 190 m, meridiano central 137,3° E (V2.prj)",
        "crs": "equirectangular",
        "radio_m": R,
        "meridiano_central_E": CM,
        "x_min_m": x_min,
        "y_max_m": y_max,
        "res_m": RES,
    }
    aoi_cells = [[(y_max - y) / RES, (x - x_min) / RES] for x, y in aoi]
    meta_terreno = {
        "fuente": "PROVISIONAL",
        "nota": "Grilla y AOI reales (Julián). Clasificación PROVISIONAL a partir del brillo y la textura de HiRISE: no es la clasificación de Julián.",
        "orden": "por filas; fila 0 = norte; idx = fila * ancho + col; índices desde 0",
    }
    out = app / "src/data/real"
    out.mkdir(parents=True, exist_ok=True)
    (out / "tipos.json").write_text(json.dumps({
        **meta_terreno, "ancho": ancho, "alto": alto, "res_m": RES, "origen": origen,
        "aoi_celdas": aoi_cells, "tipos": TIPOS, "celdas": tipos.ravel().tolist()}))
    (out / "costo.json").write_text(json.dumps({
        **meta_terreno, "ancho": ancho, "alto": alto, "res_m": RES, "prohibido": PROHIBIDO,
        "celdas": [round(float(x), 2) for x in costo.ravel()]}))
    (out / "paradas.json").write_text(json.dumps({
        "fuente": "Posiciones de V2 (Julián); hipótesis H1–H5 (Juan David)", "paradas": paradas}, ensure_ascii=False, indent=1))
    (out / "rutas.json").write_text(json.dumps({"fuente": "V2 de Julián (ruta oficial)", "rutas": rutas}, ensure_ascii=False))

    # Imagen de fondo a ~3 m/píxel, JPEG en base64
    w_img = int(round(ancho * RES / 3))
    h_img = int(round(alto * RES / 3))
    bg = crop.resize((w_img, h_img), Image.LANCZOS).convert("L")
    buf = io.BytesIO()
    bg.save(buf, "JPEG", quality=78, optimize=True, progressive=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    (app / "src/map/baseImage.ts").write_text(
        "/* Generado por scripts/build_real_data.py — HiRISE PSP_001752_1750_RED_C_01_ORTHO (NASA/JPL/UArizona), "
        "recortada a la grilla de la app. No editar a mano. */\n"
        f"export const BASE_IMAGE = 'data:image/jpeg;base64,{b64}';\n")

    total = ancho * alto
    n_in = int(dentro.sum())
    cnt = [int(((tipos == k) & dentro).sum()) for k in range(3)]
    print(f"grilla {ancho}x{alto} = {total} celdas de {RES:.0f} m; dentro del AOI {n_in}")
    print("tipos dentro del AOI (cresta, hondonada, arena):", cnt)
    for p in paradas:
        print(p["id"], p["fila"], p["col"], "tipo", p["tipo"], p["hipotesis"], p["lat"], p["lon_E"])
    for k, r in rutas.items():
        print(k, len(r["camino"]), "celdas, costo", r["costo"])
    print(f"imagen {w_img}x{h_img}, {len(buf.getvalue())/1024:.0f} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
