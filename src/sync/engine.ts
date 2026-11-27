import { type OutboxRow } from '@/db/repositories/outbox';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { upsertRecipeDerivedIndex } from '@/db/search';
import type { SqliteExecutor } from '@/db/sqliteAdapter';
import { now } from '@/lib/clock';
import { logger } from '@/lib/logger';
import type { Ingredient, Recipe, Step } from '@/types/recipe';
import { computeBackoffMs } from './backoff';

export type SyncStatusKind = 'local_only' | 'offline' | 'syncing' | 'issue' | 'pending' | 'up_to_date';

export interface SyncTransport {
  pushCreate(collection: string, ownerId: string, record: Record<string, unknown>): Promise<PushResult>;
  pushUpdate(collection: string, id: string, record: Record<string, unknown>): Promise<PushResult>;
  pullPage(collection: string, cursor: string, perPage: number): Promise<PullResult>;
}

export type PushResult =
  | { status: 'ok' }
  | { status: 'duplicate' }
  | { status: 'not_found' }
  | { status: 'conflict'; serverRecord: Record<string, unknown> }
  | { status: 'retryable'; code: number; message: string }
  | { status: 'auth'; message: string }
  | { status: 'permanent'; code: number; message: string };

export type PullResult =
  | { status: 'ok'; items: Array<Record<string, unknown>> }
  | { status: 'auth'; message: string }
  | { status: 'retryable'; message: string };

function entityToCollection(entity: OutboxRow['entity']): string {
  if (entity === 'recipe') return 'recipes';
  if (entity === 'shopping_list') return 'shopping_lists';
  return 'shopping_items';
}

export async function drainOutbox(
  db: SqliteExecutor,
  ownerId: string,
  transport: SyncTransport,
): Promise<{ processed: number; stoppedOnRetryable: boolean; needsAuth: boolean }> {
  const tNow = now();
  const pending = db.getAllSync<OutboxRow>(
    "SELECT * FROM outbox WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY CASE entity WHEN 'shopping_list' THEN 0 WHEN 'recipe' THEN 1 ELSE 2 END, seq ASC",
    [tNow],
  );

  let processed = 0;

  for (const row of pending) {
    const collection = entityToCollection(row.entity);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      db.runSync("UPDATE outbox SET status = 'parked', last_error = ? WHERE seq = ?", [
        'corrupt_payload',
        row.seq,
      ]);
      continue;
    }

    const res =
      row.op === 'create'
        ? await transport.pushCreate(collection, ownerId, payload)
        : await transport.pushUpdate(collection, row.entity_id, payload);

    if (res.status === 'ok' || res.status === 'duplicate' || res.status === 'not_found') {
      db.runSync('DELETE FROM outbox WHERE seq = ?', [row.seq]);
      processed += 1;
      continue;
    }

    if (res.status === 'conflict') {
      if (row.entity === 'recipe') {
        applyServerRecipe(db, res.serverRecord);
      }
      db.runSync('DELETE FROM outbox WHERE seq = ?', [row.seq]);
      processed += 1;
      continue;
    }

    if (res.status === 'auth') {
      logger.info('sync_auth_required', { op: row.op, id: row.entity_id });
      return { processed, stoppedOnRetryable: false, needsAuth: true };
    }

    if (res.status === 'permanent') {
      logger.error('sync_permanent_error', { op: row.op, id: row.entity_id, errorClass: String(res.code) });
      db.runSync("UPDATE outbox SET status = 'parked', last_error = ? WHERE seq = ?", [
        res.message,
        row.seq,
      ]);
      continue;
    }

    // Retryable: backoff and stop drain to preserve ordering
    const attempts = row.attempts + 1;
    const nextAttempt = now() + computeBackoffMs(attempts);
    db.runSync(
      'UPDATE outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE seq = ?',
      [attempts, nextAttempt, res.message, row.seq],
    );
    return { processed, stoppedOnRetryable: true, needsAuth: false };
  }

  return { processed, stoppedOnRetryable: false, needsAuth: false };
}

function applyServerRecipe(db: SqliteExecutor, r: Record<string, unknown>): void {
  const id = String(r.id ?? '');
  if (!id) return;
  const title = String(r.title ?? 'Untitled');
  const ingredients = Array.isArray(r.ingredients) ? (r.ingredients as Ingredient[]) : [];
  const steps = Array.isArray(r.steps) ? (r.steps as Step[]) : [];
  const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
  const notes = typeof r.notes === 'string' ? r.notes : null;
  const deletedAt = typeof r.deleted_at === 'number' ? r.deleted_at : null;
  const updatedAt = typeof r.client_updated_at === 'number' ? r.client_updated_at : now();
  const createdAt = updatedAt;

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO recipes (
        id, title, description, servings, prep_minutes, cook_minutes,
        ingredients, steps, notes, source_url, source_name,
        is_favorite, times_cooked, last_cooked_at, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        servings = excluded.servings,
        prep_minutes = excluded.prep_minutes,
        cook_minutes = excluded.cook_minutes,
        ingredients = excluded.ingredients,
        steps = excluded.steps,
        notes = excluded.notes,
        source_url = excluded.source_url,
        source_name = excluded.source_name,
        is_favorite = excluded.is_favorite,
        times_cooked = excluded.times_cooked,
        last_cooked_at = excluded.last_cooked_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at`,
      [
        id,
        title,
        typeof r.description === 'string' ? r.description : null,
        typeof r.servings === 'number' ? r.servings : 4,
        typeof r.prep_minutes === 'number' ? r.prep_minutes : null,
        typeof r.cook_minutes === 'number' ? r.cook_minutes : null,
        JSON.stringify(ingredients),
        JSON.stringify(steps),
        notes,
        typeof r.source_url === 'string' ? r.source_url : null,
        typeof r.source_name === 'string' ? r.source_name : null,
        r.is_favorite ? 1 : 0,
        typeof r.times_cooked === 'number' ? r.times_cooked : 0,
        typeof r.last_cooked_at === 'number' ? r.last_cooked_at : null,
        createdAt,
        updatedAt,
        deletedAt,
      ],
    );
    upsertRecipeDerivedIndex(db, id, title, ingredients, tags, notes, deletedAt !== null);
  });
}

export async function pullRecipes(
  db: SqliteExecutor,
  transport: SyncTransport,
  notify?: () => void,
): Promise<{ pulled: number; needsAuth: boolean }> {
  const cursorKey = 'cursor_recipes';
  const cursor = getSetting(db, cursorKey) ?? '1970-01-01 00:00:00.000Z';
  const res = await transport.pullPage('recipes', cursor, 200);
  if (res.status === 'auth') return { pulled: 0, needsAuth: true };
  if (res.status === 'retryable') return { pulled: 0, needsAuth: false };

  let maxUpdated = cursor;
  let pulled = 0;

  for (const item of res.items) {
    const id = String(item.id ?? '');
    if (!id) continue;
    const pending = db.getFirstSync<{ seq: number }>(
      "SELECT seq FROM outbox WHERE entity = 'recipe' AND entity_id = ? AND status = 'pending' LIMIT 1",
      [id],
    );
    if (!pending) {
      applyServerRecipe(db, item);
      pulled += 1;
    }
    const upd = typeof item.updated === 'string' ? item.updated : '';
    if (upd && upd > maxUpdated) maxUpdated = upd;
  }

  if (maxUpdated > cursor) {
    setSetting(db, cursorKey, maxUpdated);
  }
  if (pulled > 0) notify?.();
  return { pulled, needsAuth: false };
}

export function recipeToPocketBasePayload(r: Recipe, ownerId: string): Record<string, unknown> {
  return {
    id: r.id,
    owner: ownerId,
    title: r.title,
    description: r.description,
    servings: r.servings,
    prep_minutes: r.prepMinutes,
    cook_minutes: r.cookMinutes,
    ingredients: r.ingredients,
    steps: r.steps,
    notes: r.notes,
    source_url: r.sourceUrl,
    source_name: r.sourceName,
    tags: r.tags,
    is_favorite: r.isFavorite,
    times_cooked: r.timesCooked,
    last_cooked_at: r.lastCookedAt,
    client_updated_at: r.updatedAt,
    deleted_at: r.deletedAt,
  };
}
