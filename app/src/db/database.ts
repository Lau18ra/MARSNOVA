import * as SQLite from 'expo-sqlite';

/**
 * Base de datos local (fuente de verdad de la misión).
 * Solo guardamos hechos: observaciones y visitas. Las probabilidades se
 * recalculan a partir de ellos (ver model/beta.ts → computeBeliefs).
 */

const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE IF NOT EXISTS observation (
    uuid TEXT PRIMARY KEY NOT NULL,
    stop_id TEXT NOT NULL,
    hypothesis_id TEXT NOT NULL,
    terrain_type INTEGER NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('si', 'no', 'inconcluso')),
    note TEXT NOT NULL DEFAULT '',
    fila INTEGER NOT NULL,
    col INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (sync_status IN ('pendiente', 'sincronizado'))
  );
  CREATE TABLE IF NOT EXISTS visit (
    uuid TEXT PRIMARY KEY NOT NULL,
    stop_id TEXT NOT NULL,
    terrain_type INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (sync_status IN ('pendiente', 'sincronizado'))
  );
  CREATE TABLE IF NOT EXISTS sync_queue (
    uuid TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('observation', 'visit')),
    entity_uuid TEXT NOT NULL UNIQUE,
    operation TEXT NOT NULL DEFAULT 'insert',
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'enviado', 'error')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
  -- Servidor SIMULADO: en la demo hace de "Tierra". INSERT OR IGNORE por UUID = idempotente.
  CREATE TABLE IF NOT EXISTS sim_server (
    entity_uuid TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    received_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_obs_created ON observation (created_at);
  CREATE INDEX IF NOT EXISTS idx_visit_created ON visit (created_at);
  `,
  // v2: resultado "no_aplica" (protocolo de ciencia). SQLite no permite cambiar un CHECK:
  // se reconstruye la tabla conservando todas las observaciones.
  `
  CREATE TABLE observation_v2 (
    uuid TEXT PRIMARY KEY NOT NULL,
    stop_id TEXT NOT NULL,
    hypothesis_id TEXT NOT NULL,
    terrain_type INTEGER NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('si', 'no', 'inconcluso', 'no_aplica')),
    note TEXT NOT NULL DEFAULT '',
    fila INTEGER NOT NULL,
    col INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (sync_status IN ('pendiente', 'sincronizado'))
  );
  INSERT INTO observation_v2 SELECT uuid, stop_id, hypothesis_id, terrain_type, result, note, fila, col, created_at, sync_status FROM observation;
  DROP TABLE observation;
  ALTER TABLE observation_v2 RENAME TO observation;
  CREATE INDEX IF NOT EXISTS idx_obs_created ON observation (created_at);
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('marsnova.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

/** Borra la misión local (solo para reiniciar la demo). */
export async function resetMission() {
  const db = await getDb();
  await db.execAsync('DELETE FROM observation; DELETE FROM visit; DELETE FROM sync_queue; DELETE FROM sim_server;');
}
