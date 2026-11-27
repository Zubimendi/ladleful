import { DatabaseSync } from 'node:sqlite';
import { getPendingOutboxCount, getParkedOutboxCount } from '@/db/repositories/outbox';
import { getRecipeById, saveRecipe, softDeleteRecipe } from '@/db/repositories/recipes';
import { setSetting } from '@/db/repositories/settings';
import { INIT_SCHEMA_SQL, type SqlBindValue, type SqliteExecutor } from '@/db/sqliteAdapter';
import { parseIngredientLines } from '@/domain/ingredient';
import { computeBackoffMs } from '@/sync/backoff';
import { drainOutbox, pullRecipes, type SyncTransport } from '@/sync/engine';

function createMemDb(): SqliteExecutor {
  const db = new DatabaseSync(':memory:');
  const exec: SqliteExecutor = {
    execSync: (sql) => db.exec(sql),
    runSync: (sql, params: SqlBindValue[] = []) => {
      const res = db.prepare(sql).run(...params);
      return { changes: Number(res.changes), lastInsertRowId: Number(res.lastInsertRowid) };
    },
    getFirstSync: <T,>(sql: string, params: SqlBindValue[] = []) =>
      (db.prepare(sql).get(...params) as T | undefined) ?? null,
    getAllSync: <T,>(sql: string, params: SqlBindValue[] = []) =>
      db.prepare(sql).all(...params) as T[],
    withTransactionSync: <T,>(fn: () => T) => {
      db.exec('BEGIN IMMEDIATE;');
      try {
        const r = fn();
        db.exec('COMMIT;');
        return r;
      } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
      }
    },
  };
  exec.execSync(INIT_SCHEMA_SQL);
  return exec;
}

describe('sync outbox & backoff', () => {
  it('computes exponential backoff with jitter capped at 300s', () => {
    expect(computeBackoffMs(0, 0.5)).toBe(2000);
    expect(computeBackoffMs(1, 0.5)).toBe(4000);
    expect(computeBackoffMs(20, 0.5)).toBe(300000);
  });

  it('coalesces create+delete for unsynced entity and drains create+update', async () => {
    const db = createMemDb();
    setSetting(db, 'sync_owner_id', 'user12345678901');

    const r1 = saveRecipe(db, {
      title: 'Ephemeral',
      description: null,
      servings: 2,
      prepMinutes: 5,
      cookMinutes: 5,
      ingredients: parseIngredientLines('1 egg'),
      steps: [{ text: 'Fry.' }],
      notes: null,
      sourceUrl: null,
      sourceName: null,
      tags: [],
    });
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      softDeleteRecipe(db, r1.value.id);
    }
    expect(getPendingOutboxCount(db)).toBe(0);

    const r2 = saveRecipe(db, {
      title: 'Persistent',
      description: null,
      servings: 2,
      prepMinutes: 5,
      cookMinutes: 5,
      ingredients: parseIngredientLines('2 eggs'),
      steps: [{ text: 'Boil.' }],
      notes: null,
      sourceUrl: null,
      sourceName: null,
      tags: [],
    });
    expect(getPendingOutboxCount(db)).toBe(1);

    const transport: SyncTransport = {
      pushCreate: async () => ({ status: 'ok' }),
      pushUpdate: async () => ({ status: 'ok' }),
      pullPage: async () => ({
        status: 'ok',
        items: [
          {
            id: 'serverrec000001',
            title: 'Server Recipe',
            servings: 4,
            ingredients: [{ raw: '1 cup rice', qty: 1, qtyMax: null, unit: 'cup', name: 'rice', note: null, group: null, warn: false }],
            steps: [{ text: 'Cook.' }],
            tags: ['rice'],
            updated: '2026-11-26 10:00:00.000Z',
          },
        ],
      }),
    };

    const drained = await drainOutbox(db, 'user12345678901', transport);
    expect(drained.processed).toBe(1);
    expect(getPendingOutboxCount(db)).toBe(0);

    const pulled = await pullRecipes(db, transport);
    expect(pulled.pulled).toBe(1);
    expect(getRecipeById(db, 'serverrec000001')?.title).toBe('Server Recipe');
    expect(r2.ok).toBe(true);
  });

  it('parks permanent errors and stops on retryable errors', async () => {
    const db = createMemDb();
    setSetting(db, 'sync_owner_id', 'user12345678901');

    saveRecipe(db, {
      title: 'Bad',
      description: null,
      servings: 2,
      prepMinutes: null,
      cookMinutes: null,
      ingredients: parseIngredientLines('1 egg'),
      steps: [],
      notes: null,
      sourceUrl: null,
      sourceName: null,
      tags: [],
    });
    saveRecipe(db, {
      title: 'Retryable',
      description: null,
      servings: 2,
      prepMinutes: null,
      cookMinutes: null,
      ingredients: parseIngredientLines('1 egg'),
      steps: [],
      notes: null,
      sourceUrl: null,
      sourceName: null,
      tags: [],
    });

    let call = 0;
    const transport: SyncTransport = {
      pushCreate: async () => {
        call += 1;
        if (call === 1) return { status: 'permanent', code: 400, message: 'bad_field' };
        return { status: 'retryable', code: 503, message: 'unavailable' };
      },
      pushUpdate: async () => ({ status: 'ok' }),
      pullPage: async () => ({ status: 'ok', items: [] }),
    };

    const res = await drainOutbox(db, 'user12345678901', transport);
    expect(res.stoppedOnRetryable).toBe(true);
    expect(getParkedOutboxCount(db)).toBe(1);
    expect(getPendingOutboxCount(db)).toBe(1);
  });
});
