import { getDb } from './database';

/**
 * Sincronización SIMULADA con "la Tierra".
 * Reglas: el registro ya está guardado antes de transmitir; el servidor
 * acepta por UUID (INSERT OR IGNORE), así que reenviar no duplica; nada local
 * se borra; si un envío falla, queda en la cola con retry_count + 1.
 * Para un backend real, solo cambia `sendToServer`.
 */

type QueueRow = { uuid: string; entity_type: 'observation' | 'visit'; entity_uuid: string; retry_count: number };

export type SyncReport = { enviados: number; fallidos: number; pendientes: number };

/** Probabilidad de fallo simulado por envío (0 = nunca falla). Útil para mostrar reintentos. */
export let simulatedFailureRate = 0;
export const setSimulatedFailureRate = (r: number) => {
  simulatedFailureRate = r;
};

async function sendToServer(entityType: string, entityUuid: string, payload: unknown) {
  if (Math.random() < simulatedFailureRate) throw new Error('Fallo simulado de enlace');
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO sim_server (entity_uuid, entity_type, payload, received_at) VALUES (?, ?, ?, ?)',
    entityUuid, entityType, JSON.stringify(payload), new Date().toISOString(),
  );
}

let running = false;

export async function syncPending(): Promise<SyncReport> {
  const db = await getDb();
  if (running) return { enviados: 0, fallidos: 0, pendientes: await countPending() };
  running = true;
  let enviados = 0;
  let fallidos = 0;
  try {
    const queue = await db.getAllAsync<QueueRow>(
      `SELECT uuid, entity_type, entity_uuid, retry_count FROM sync_queue WHERE status != 'enviado' ORDER BY rowid`,
    );
    for (const q of queue) {
      const table = q.entity_type === 'observation' ? 'observation' : 'visit';
      const payload = await db.getFirstAsync(`SELECT * FROM ${table} WHERE uuid = ?`, q.entity_uuid);
      try {
        await sendToServer(q.entity_type, q.entity_uuid, payload);
        // Confirmación recibida: solo ahora se marca como sincronizado.
        await db.withTransactionAsync(async () => {
          await db.runAsync(`UPDATE sync_queue SET status = 'enviado', last_error = NULL WHERE uuid = ?`, q.uuid);
          await db.runAsync(`UPDATE ${table} SET sync_status = 'sincronizado' WHERE uuid = ?`, q.entity_uuid);
        });
        enviados += 1;
      } catch (e) {
        await db.runAsync(
          `UPDATE sync_queue SET status = 'error', retry_count = retry_count + 1, last_error = ? WHERE uuid = ?`,
          String(e instanceof Error ? e.message : e), q.uuid,
        );
        fallidos += 1;
      }
    }
  } finally {
    running = false;
  }
  return { enviados, fallidos, pendientes: await countPending() };
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM sync_queue WHERE status != 'enviado'`);
  return r?.n ?? 0;
}

/** Para la prueba de "sin duplicados": registros en el servidor vs. registros únicos. */
export async function serverStats(): Promise<{ recibidos: number; unicos: number; local: number }> {
  const db = await getDb();
  const s = await db.getFirstAsync<{ recibidos: number; unicos: number }>(
    'SELECT COUNT(*) AS recibidos, COUNT(DISTINCT entity_uuid) AS unicos FROM sim_server',
  );
  const l = await db.getFirstAsync<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM observation) + (SELECT COUNT(*) FROM visit) AS n',
  );
  return { recibidos: s?.recibidos ?? 0, unicos: s?.unicos ?? 0, local: l?.n ?? 0 };
}
