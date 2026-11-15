import { describe, expect, it } from 'vitest';
import { angleDiff, bearingDeg, gpsToGrid, navigate, projectOnPath } from './tracking';

// Ruta recta hacia el este: fila 10, de col 0 a col 20 (celdas de 10 m → 200 m).
const path = Array.from({ length: 21 }, (_, i) => ({ fila: 10, col: i }));
const RES = 10;

describe('rumbos', () => {
  it('0° = norte (fila decreciente), 90° = este', () => {
    expect(bearingDeg({ fila: 10, col: 0 }, { fila: 0, col: 0 })).toBeCloseTo(0);
    expect(bearingDeg({ fila: 0, col: 0 }, { fila: 0, col: 5 })).toBeCloseTo(90);
    expect(bearingDeg({ fila: 0, col: 0 }, { fila: 5, col: 0 })).toBeCloseTo(180);
    expect(bearingDeg({ fila: 0, col: 5 }, { fila: 0, col: 0 })).toBeCloseTo(270);
  });
  it('angleDiff da el giro más corto con signo', () => {
    expect(angleDiff(10, 350)).toBeCloseTo(20);
    expect(angleDiff(350, 10)).toBeCloseTo(-20);
    expect(angleDiff(180, 0)).toBeCloseTo(180);
  });
});

describe('proyección sobre la ruta', () => {
  it('mide la distancia perpendicular y lo recorrido', () => {
    const p = projectOnPath({ fila: 7, col: 5.5 }, path)!;
    expect(p.dist).toBeCloseTo(3);
    expect(p.along).toBeCloseTo(5.5);
    expect(p.total).toBeCloseTo(20);
  });
});

describe('navegación', () => {
  it('en la ruta y mirando al este → en_ruta, sigue derecho', () => {
    const n = navigate({ fila: 10.5, col: 5 }, path, 90, RES)!;
    expect(n.status).toBe('en_ruta');
    expect(Math.abs(n.turnDeg!)).toBeLessThan(20);
    expect(n.remainingM).toBeCloseTo(150, 0);
  });
  it('a 30 m de la ruta → desviado y apunta de vuelta a la ruta (sur)', () => {
    const n = navigate({ fila: 7, col: 5 }, path, 90, RES)!;
    expect(n.status).toBe('desviado');
    expect(n.offRouteM).toBeCloseTo(30);
    expect(n.targetBearing).toBeCloseTo(180);
  });
  it('en la ruta pero mirando al oeste → sentido_contrario', () => {
    expect(navigate({ fila: 10, col: 5 }, path, 270, RES)!.status).toBe('sentido_contrario');
  });
  it('a menos de 15 m del final → llegando', () => {
    expect(navigate({ fila: 10, col: 19 }, path, 90, RES)!.status).toBe('llegando');
  });
  it('sin rumbo no puede decir sentido contrario, pero sí la dirección', () => {
    const n = navigate({ fila: 10, col: 5 }, path, null, RES)!;
    expect(n.status).toBe('en_ruta');
    expect(n.turnDeg).toBeNull();
    expect(n.targetBearing).toBeCloseTo(90);
  });
});

describe('GPS → grilla', () => {
  const anchor = { lat: 4.6, lon: -74.08, fila: 100, col: 100 };
  it('el ancla cae en su celda', () => {
    const p = gpsToGrid(anchor.lat, anchor.lon, anchor, RES);
    expect(p.fila).toBeCloseTo(100);
    expect(p.col).toBeCloseTo(100);
  });
  it('100 m al norte = 10 celdas menos de fila; 100 m al este = 10 celdas más de col', () => {
    const dLat = 100 / 6371008.8 * (180 / Math.PI);
    const dLon = dLat / Math.cos(anchor.lat * Math.PI / 180);
    expect(gpsToGrid(anchor.lat + dLat, anchor.lon, anchor, RES).fila).toBeCloseTo(90, 6);
    expect(gpsToGrid(anchor.lat, anchor.lon + dLon, anchor, RES).col).toBeCloseTo(110, 6);
  });
});
