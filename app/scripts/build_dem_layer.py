"""
Capa de relieve del mapa a partir del DEM de Julián (DTM.AOI.10M.LIMPIO.tif, 10 m, misma grilla).

Genera src/map/demImage.ts con:
  - DEM_IMAGE: PNG (data URI) del tamaño exacto de la grilla de la app. Color por altura
    (rampa viridis: bajo = morado, alto = amarillo) multiplicado por un sombreado
    (luz desde el noroeste, 45°). NoData del DEM = transparente.
  - DEM_RANGE: cota mínima y máxima en metros (para la leyenda).

Uso:
  python3 scripts/build_dem_layer.py "<carpeta ENTREGA SIG>" <carpeta app marsnova>
Requiere: numpy y Pillow.
"""
import base64
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

NODATA = -9999.0
DTM = "02 RASTERS PROCESADOS/DTM.AOI.10M.LIMPIO.tif"
# Viridis (4 paradas): no se confunde con la capa de probabilidad (cian → gris → naranja).
RAMP = np.array([[68, 1, 84], [49, 104, 142], [53, 183, 121], [253, 231, 37]], dtype=np.float64)


def read_tif(path):
    im = Image.open(path)
    a = np.asarray(im, dtype=np.float64)
    sx, sy = im.tag_v2[33550][:2]
    tp = im.tag_v2[33922]
    return a, (tp[3], tp[4], sx, sy)


def hillshade(z, res, azimuth=315.0, altitude=45.0):
    dzdy, dzdx = np.gradient(z, res)  # filas crecen hacia el sur
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(-dzdx, dzdy)
    az, alt = np.radians(360.0 - azimuth + 90.0), np.radians(altitude)
    hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(hs, 0, 1)


def ramp(t):
    x = np.clip(t, 0, 1) * (len(RAMP) - 1)
    i = np.minimum(x.astype(int), len(RAMP) - 2)
    f = (x - i)[..., None]
    return RAMP[i] * (1 - f) + RAMP[i + 1] * f


def main(sig, app):
    sig, app = Path(sig), Path(app)
    o = json.loads((app / "src/data/real/tipos.json").read_text())
    W, H, org = o["ancho"], o["alto"], o["origen"]

    a, (x0, y0, sx, sy) = read_tif(sig / DTM)
    if abs(sx - org["res_m"]) > 1e-6 or abs(sy - org["res_m"]) > 1e-6:
        raise SystemExit(f"{DTM}: resolución {sx}×{sy}, la app usa {org['res_m']}")
    dc = (x0 - org["x_min_m"]) / org["res_m"]
    dr = (org["y_max_m"] - y0) / org["res_m"]
    if abs(dc - round(dc)) > 1e-3 or abs(dr - round(dr)) > 1e-3:
        raise SystemExit(f"{DTM}: no está alineado con la grilla de la app")
    dc, dr = int(round(dc)), int(round(dr))

    # Colocar el DEM en la grilla de la app (recorta lo que sobre, rellena con NoData).
    z = np.full((H, W), NODATA)
    r0, c0 = max(dr, 0), max(dc, 0)
    r1, c1 = min(dr + a.shape[0], H), min(dc + a.shape[1], W)
    z[r0:r1, c0:c1] = a[r0 - dr:r1 - dr, c0 - dc:c1 - dc]

    valid = z > NODATA / 2
    if not valid.any():
        raise SystemExit("El DEM no tiene celdas válidas dentro de la grilla")
    zmin, zmax = float(z[valid].min()), float(z[valid].max())

    # Para el sombreado, los huecos toman la cota media de sus vecinos (evita bordes falsos).
    zf = np.where(valid, z, np.nan)
    fill = np.nanmean(zf)
    zf = np.where(valid, z, fill)
    hs = hillshade(zf, org["res_m"])

    col = ramp((z - zmin) / (zmax - zmin)) * (0.35 + 0.65 * hs[..., None])
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.where(valid, 255, 0)

    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    out = app / "src/map/demImage.ts"
    out.write_text(
        "// Generado por scripts/build_dem_layer.py a partir de DTM.AOI.10M.LIMPIO.tif (Julián). No editar a mano.\n"
        f"export const DEM_IMAGE = 'data:image/png;base64,{b64}';\n"
        f"export const DEM_RANGE = {{ min: {zmin:.0f}, max: {zmax:.0f} }};\n"
    )
    print(f"{out}: {W}×{H}, cotas {zmin:.0f} a {zmax:.0f} m, "
          f"{valid.sum()} celdas con dato, {len(buf.getvalue()) / 1024:.0f} KB")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
