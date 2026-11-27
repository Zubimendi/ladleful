import { now } from '@/lib/clock';
import type { SqliteExecutor } from '../sqliteAdapter';

export type OutboxEntity = 'recipe' | 'shopping_list' | 'shopping_item';
export type OutboxOp = 'create' | 'update' | 'delete';

export interface OutboxRow {
  seq: number;
  entity: OutboxEntity;
  entity_id: string;
  op: OutboxOp;
  payload: string;
  attempts: number;
  next_attempt_at: number;
  status: 'pending' | 'parked';
  last_error: string | null;
  created_at: number;
}

export function isSignedInForOutbox(db: SqliteExecutor): boolean {
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['sync_owner_id'],
  );
  return Boolean(row && row.value.trim().length > 0);
}

/**
 * Enqueue an outbox operation inside the caller's transaction, coalescing
 * against any pending operation for the same entity.
 */
export function enqueueOutboxIfSignedIn(
  db: SqliteExecutor,
  entity: OutboxEntity,
  entityId: string,
  op: OutboxOp,
  payloadObj: unknown,
): void {
  if (!isSignedInForOutbox(db)) return;

  const payload = JSON.stringify(payloadObj);
  const existing = db.getFirstSync<OutboxRow>(
    "SELECT * FROM outbox WHERE entity = ? AND entity_id = ? AND status = 'pending' ORDER BY seq DESC LIMIT 1",
    [entity, entityId],
  );

  if (!existing) {
    db.runSync(
      'INSERT INTO outbox (entity, entity_id, op, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      [entity, entityId, op, payload, now()],
    );
    return;
  }

  if (existing.op === 'create' && op === 'update') {
    db.runSync('UPDATE outbox SET payload = ? WHERE seq = ?', [payload, existing.seq]);
    return;
  }

  if (existing.op === 'create' && op === 'delete') {
    db.runSync('DELETE FROM outbox WHERE seq = ?', [existing.seq]);
    return;
  }

  if (existing.op === 'update' && op === 'delete') {
    db.runSync("UPDATE outbox SET op = 'delete', payload = ? WHERE seq = ?", [
      payload,
      existing.seq,
    ]);
    return;
  }

  db.runSync('UPDATE outbox SET payload = ? WHERE seq = ?', [payload, existing.seq]);
}

export function getPendingOutboxCount(db: SqliteExecutor): number {
  const row = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM outbox WHERE status = 'pending'",
  );
  return row?.cnt ?? 0;
}

export function getParkedOutboxCount(db: SqliteExecutor): number {
  const row = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM outbox WHERE status = 'parked'",
  );
  return row?.cnt ?? 0;
}
