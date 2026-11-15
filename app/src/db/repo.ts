import * as Crypto from 'expo-crypto';
import type { ObservationResult } from '@/model/types';
import { getDb } from './database';

export type ObservationRow = {
  uuid: string;
  stop_id: string;
  hypothesis_id: string;
  terrain_type: number;
  result: ObservationResult;
  note: string;
  fila: number;
  col: number;
  created_at: string;
  sync_status: 'pendiente' | 'sincronizado';
};

export type VisitRow = {
  uuid: string;
  stop_id: string;
  terrain_type: number;
  created_at: string;
  sync_status: 'pendiente' | 'sincronizado';
};

const now = () => new Date().toISOString();

export async function listObservations(): Promise<ObservationRow[]> {
  const db = await getDb();
  return db.getAllAsync<ObservationRow>('SELECT * FROM observation ORDER BY created_at ASC');
}

export async function listVisits(): Promise<VisitRow[]> {
  const db = await getDb();
  return db.getAllAsync<VisitRow>('SELECT * FROM visit ORDER BY created_at ASC');
}

/** Guarda primero en local y lo encola; la transmisión ocurre después. */
export async function insertObservation(o: {
  stopId: string;
  hypothesisId: string;
  terrainType: number;
  result: ObservationResult;
  note: string;
  fila: number;
  col: number;
}): Promise<ObservationRow> {
  const db = await getDb();
  const row: ObservationRow = {
    uuid: Crypto.randomUUID(),
    stop_id: o.stopId,
    hypothesis_id: o.hypothesisId,
    terrain_type: o.terrainType,
    result: o.result,
    note: o.note,
    fila: o.fila,
    col: o.col,
    created_at: now(),
    sync_status: 'pendiente',
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO observation (uuid, stop_id, hypothesis_id, terrain_type, result, note, fila, col, created_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      row.uuid, row.stop_id, row.hypothesis_id, row.terrain_type, row.result, row.note, row.fila, row.col, row.created_at,
    );
    await db.runAsync(
      `INSERT INTO sync_queue (uuid, entity_type, entity_uuid) VALUES (?, 'observation', ?)`,
      Crypto.randomUUID(), row.uuid,
    );
  });
  return row;
}

export async function insertVisit(v: { stopId: string; terrainType: number }): Promise<VisitRow> {
  const db = await getDb();
  const row: VisitRow = {
    uuid: Crypto.randomUUID(),
    stop_id: v.stopId,
    terrain_type: v.terrainType,
    created_at: now(),
    sync_status: 'pendiente',
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO visit (uuid, stop_id, terrain_type, created_at, sync_status) VALUES (?, ?, ?, ?, 'pendiente')`,
      row.uuid, row.stop_id, row.terrain_type, row.created_at,
    );
    await db.runAsync(
      `INSERT INTO sync_queue (uuid, entity_type, entity_uuid) VALUES (?, 'visit', ?)`,
      Crypto.randomUUID(), row.uuid,
    );
  });
  return row;
}
