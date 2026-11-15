import { LEAFLET_CSS, LEAFLET_JS } from './leafletAssets';
import type { MapInit } from './bridge';

/**
 * HTML del mapa con Leaflet incluido (sin CDN → funciona sin conexión).
 * Sistema de coordenadas: L.CRS.Simple con lat = -fila y lng = col, de modo
 * que la grilla científica (fila, col) se dibuja tal cual, sin Web Mercator.
 * La conversión a coordenadas marcianas reales vive en utils/coordinates.ts.
 */
const safe = (s: string) => s.replace(/<\/script/gi, '<\\/script');

export function buildMapHtml(init: MapInit): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${LEAFLET_CSS}</style>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; background: #0B0D12; }
  .leaflet-container { background: #0B0D12; }
  .leaflet-image-layer { image-rendering: pixelated; image-rendering: crisp-edges; }
  .leaflet-image-layer.dem { image-rendering: auto; }
  .stop-label { background: rgba(11,13,18,0.85); color: #F3EDE4; border: 1px solid #3A3F4B;
    border-radius: 6px; font: 600 11px -apple-system, system-ui, sans-serif; padding: 2px 6px; box-shadow: none; }
  .stop-label::before { display: none; }
  .me { width: 18px; height: 18px; border-radius: 50%; background: #4FD1C5; border: 3px solid #0B0D12;
    box-shadow: 0 0 0 0 rgba(79,209,197,0.7); animation: pulse 1.8s infinite; }
  .walker { width: 30px; height: 30px; position: relative; }
  .walker .dot { position: absolute; left: 7px; top: 7px; width: 16px; height: 16px; border-radius: 50%;
    border: 3px solid #0B0D12; box-sizing: border-box; }
  .walker .arrow { position: absolute; left: 9px; top: -4px; width: 0; height: 0;
    border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 11px solid; }
  .walker .rot { position: absolute; inset: 0; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(79,209,197,0.7);} 70% { box-shadow: 0 0 0 14px rgba(79,209,197,0);} 100% { box-shadow: 0 0 0 0 rgba(79,209,197,0);} }
</style>
<script>${safe(LEAFLET_JS)}</script>
</head><body><div id="map"></div>
<script>
(function () {
  var INIT = ${safe(JSON.stringify(init))};
  var W = INIT.ancho, H = INIT.alto;
  var bounds = [[-H, 0], [0, W]];
  var map = L.map('map', { crs: L.CRS.Simple, zoomControl: false, attributionControl: false,
    minZoom: -2, maxZoom: 4, zoomSnap: 0.25, maxBounds: [[-H * 1.2, -W * 0.2], [H * 0.2, W * 1.2]] });
  map.fitBounds(bounds, { padding: [8, 8] });

  function post(msg) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function hex(c) { return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)]; }

  // ---- Capa base: tipo de terreno sombreado por costo (relieve aproximado) ----
  // Cuando Julián entregue terreno.png, se reemplaza por L.imageOverlay(imagen, bounds).
  function baseLayer() {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d'); var img = ctx.createImageData(W, H);
    var colors = {}; INIT.tiposDef.forEach(function (t) { colors[t.id] = hex(t.color); });
    var maxC = 0; for (var i = 0; i < INIT.costo.length; i++) if (INIT.costo[i] > maxC) maxC = INIT.costo[i];
    for (var k = 0; k < W * H; k++) {
      var c = colors[INIT.tipos[k]] || [80, 80, 80];
      var cost = INIT.costo[k];
      var shade = cost === INIT.prohibido ? 0.25 : 0.55 + 0.45 * (1 - cost / maxC);
      img.data[k*4] = c[0] * shade; img.data[k*4+1] = c[1] * shade; img.data[k*4+2] = c[2] * shade; img.data[k*4+3] = 255;
      if (cost === INIT.prohibido) { img.data[k*4] = 120; img.data[k*4+1] = 20; img.data[k*4+2] = 30; }
    }
    ctx.putImageData(img, 0, 0);
    return L.imageOverlay(cv.toDataURL(), bounds, { pane: 'fondo' });
  }
  // Panes propios para que fondo y relieve queden siempre debajo de probabilidad, rutas y paradas (overlayPane = 400).
  map.createPane('fondo').style.zIndex = 300;
  map.createPane('relieve').style.zIndex = 350;
  // La probabilidad es una imagen: en overlayPane taparía el SVG de rutas y paradas, así que va en su propio pane debajo.
  map.createPane('probabilidad').style.zIndex = 380;
  var layers = { base: (INIT.baseImage ? L.imageOverlay(INIT.baseImage, bounds, { pane: 'fondo' }) : baseLayer()).addTo(map) };
  // ---- Relieve (DEM de Julián): color por altura + sombreado, encima del fondo ----
  var demLayer = INIT.demImage ? L.imageOverlay(INIT.demImage, bounds, { pane: 'relieve', opacity: 0.75, className: 'dem', interactive: false }) : null;
  if (INIT.aoi && INIT.aoi.length > 2) {
    L.polygon(INIT.aoi.map(function (p) { return [-p[0], p[1]]; }),
      { color: '#F3EDE4', weight: 1.5, opacity: 0.8, fill: false, dashArray: '4 4', interactive: false }).addTo(map);
  }

  // ---- Capa de probabilidad: el "mapa que aprende" ----
  var probLayer = null;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function probColor(p) { // 0 = cian (contradice) · 0,5 = gris · 1 = ámbar (confirma)
    var lo = [63, 167, 214], mid = [150, 150, 160], hi = [255, 140, 50];
    return p < 0.5 ? [lerp(lo[0],mid[0],p*2), lerp(lo[1],mid[1],p*2), lerp(lo[2],mid[2],p*2)]
                   : [lerp(mid[0],hi[0],(p-0.5)*2), lerp(mid[1],hi[1],(p-0.5)*2), lerp(mid[2],hi[2],(p-0.5)*2)];
  }
  function drawProb(byType, visible) {
    if (probLayer) { map.removeLayer(probLayer); probLayer = null; }
    if (!visible) return;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d'); var img = ctx.createImageData(W, H);
    for (var k = 0; k < W * H; k++) {
      var b = byType[INIT.tipos[k]];
      if (!b || INIT.costo[k] === INIT.prohibido) continue;
      var c = probColor(b.p);
      img.data[k*4] = c[0]; img.data[k*4+1] = c[1]; img.data[k*4+2] = c[2];
      img.data[k*4+3] = Math.round(255 * (INIT.baseImage ? 0.25 + 0.45 * (1 - b.u) : 0.4 + 0.6 * (1 - b.u))); // más incierto = más transparente
    }
    ctx.putImageData(img, 0, 0);
    probLayer = L.imageOverlay(cv.toDataURL(), bounds, { pane: 'probabilidad', opacity: 0.95, interactive: false }).addTo(map);
  }

  // ---- Paradas, posición y ruta ----
  function ll(fila, col) { return [-(fila + 0.5), col + 0.5]; }
  // Recorrido completo planeado (estático): debajo de la ruta activa y de las paradas.
  var fullLayer = INIT.fullRoute && INIT.fullRoute.length > 1 ? L.layerGroup([
    L.polyline(INIT.fullRoute.map(function (c) { return ll(c[0], c[1]); }), { color: '#0B0D12', weight: 5, opacity: 0.6, interactive: false }),
    L.polyline(INIT.fullRoute.map(function (c) { return ll(c[0], c[1]); }), { color: '#B794F4', weight: 2.5, dashArray: '2 5', interactive: false }),
  ]) : null;
  var stopLayer = L.layerGroup().addTo(map);
  var meMarker = null, routeLayer = null;

  function drawStops(state) {
    stopLayer.clearLayers();
    INIT.paradas.forEach(function (s) {
      var visited = state.visited.indexOf(s.id) >= 0;
      var suggested = state.suggestedId === s.id;
      var m = L.circleMarker(ll(s.fila, s.col), {
        radius: s.es_base ? 9 : 8, weight: suggested ? 4 : 2,
        color: suggested ? '#4FD1C5' : '#F3EDE4',
        fillColor: s.es_base ? '#F3EDE4' : visited ? '#6B7280' : '#E4572E', fillOpacity: 1,
      }).addTo(stopLayer);
      m.bindTooltip(s.nombre.replace('PRUEBA – ', ''), { permanent: state.showLabels, direction: 'top', offset: [0, -8], className: 'stop-label' });
      m.on('click', function () { post({ type: 'stopPress', id: s.id }); });
    });
    var cur = INIT.paradas.filter(function (s) { return s.id === state.currentStopId; })[0];
    if (meMarker) map.removeLayer(meMarker);
    meMarker = null;
    if (cur && !walkerOn) meMarker = L.marker(ll(cur.fila, cur.col), { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
  }

  function drawRoute(route) {
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (!route) return;
    var pts = route.path.map(function (c) { return ll(c[0], c[1]); });
    routeLayer = L.layerGroup([
      L.polyline(pts, { color: '#0B0D12', weight: 7, opacity: 0.8 }),
      L.polyline(pts, { color: '#4FD1C5', weight: 3.5, dashArray: route.live ? '6 6' : null }),
    ].concat((route.alerts || []).map(function (c) {
      return L.circleMarker(ll(c[0], c[1]), { radius: 6, color: '#0B0D12', weight: 2, fillColor: '#E5484D', fillOpacity: 1, interactive: false });
    }))).addTo(map);
  }

  // ---- Astronauta en vivo (GPS o simulación) ----
  var walkerOn = false, walkerMarker = null, trailLine = null, backLine = null, followed = false;
  var WALKER_COLORS = { en_ruta: '#4FD1C5', llegando: '#4FD1C5', desviado: '#E5484D', sentido_contrario: '#FF8C32', sin_ruta: '#F3EDE4' };
  window.marsWalker = function (w) {
    try {
      if (!w) {
        [walkerMarker, trailLine, backLine].forEach(function (l) { if (l) map.removeLayer(l); });
        walkerMarker = trailLine = backLine = null; followed = false;
        if (walkerOn) { walkerOn = false; if (lastState) drawStops(lastState); }
        return;
      }
      if (!walkerOn) { walkerOn = true; if (meMarker) { map.removeLayer(meMarker); meMarker = null; } }
      var p = ll(w.pos[0], w.pos[1]);
      var color = WALKER_COLORS[w.status] || '#F3EDE4';
      var trailPts = w.trail.map(function (c) { return ll(c[0], c[1]); });
      if (!trailLine) trailLine = L.polyline(trailPts, { color: '#F3EDE4', weight: 2, opacity: 0.55, interactive: false }).addTo(map);
      else trailLine.setLatLngs(trailPts);
      if (w.status === 'desviado' && w.closest) {
        var pts = [p, ll(w.closest[0], w.closest[1])];
        if (!backLine) backLine = L.polyline(pts, { color: '#E5484D', weight: 2.5, dashArray: '4 6', interactive: false }).addTo(map);
        else backLine.setLatLngs(pts);
      } else if (backLine) { map.removeLayer(backLine); backLine = null; }
      var arrow = w.heading == null ? '' : '<div class="rot" style="transform: rotate(' + w.heading + 'deg)"><div class="arrow" style="border-bottom-color:' + color + '"></div></div>';
      var icon = L.divIcon({ className: '', html: '<div class="walker">' + arrow + '<div class="dot" style="background:' + color + '"></div></div>', iconSize: [30, 30], iconAnchor: [15, 15] });
      if (!walkerMarker) walkerMarker = L.marker(p, { icon: icon, interactive: false, zIndexOffset: 2000 }).addTo(map);
      else { walkerMarker.setLatLng(p); walkerMarker.setIcon(icon); }
      if (!followed) { map.panTo(p); followed = true; }
      else if (!map.getBounds().pad(-0.15).contains(p)) map.panTo(p);
    } catch (e) { post({ type: 'error', message: String(e) }); }
  };

  var lastState = null;
  window.marsUpdate = function (state) {
    lastState = state;
    try {
      if (state.layers) {
        if (state.layers.base && !map.hasLayer(layers.base)) layers.base.addTo(map);
        if (!state.layers.base && map.hasLayer(layers.base)) map.removeLayer(layers.base);
      }
      if (demLayer) {
        var showDem = !!(state.layers && state.layers.dem);
        if (showDem && !map.hasLayer(demLayer)) demLayer.addTo(map);
        if (!showDem && map.hasLayer(demLayer)) map.removeLayer(demLayer);
      }
      var showProb = !state.layers || state.layers.prob;
      layers.base.setOpacity(showProb && !INIT.baseImage ? 0.45 : 1); // el fondo sintético se atenúa; la foto real no
      drawProb(state.probByType || {}, showProb);
      if (fullLayer) {
        var showFull = !!(state.layers && state.layers.full);
        if (showFull && !map.hasLayer(fullLayer)) fullLayer.addTo(map);
        if (!showFull && map.hasLayer(fullLayer)) map.removeLayer(fullLayer);
        if (showFull) fullLayer.eachLayer(function (l) { l.bringToFront(); });
      }
      drawRoute(state.route);
      drawStops(state);
    } catch (e) { post({ type: 'error', message: String(e) }); }
  };
  post({ type: 'ready' });
})();
</script>
</body></html>`;
}
