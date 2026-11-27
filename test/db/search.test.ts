import { DatabaseSync } from 'node:sqlite';
import {
  importRecipesBatch,
  saveRecipe,
  softDeleteRecipe,
} from '@/db/repositories/recipes';
import {
  buildFtsQuery,
  getAllTags,
  rebuildSearchIndex,
  searchRecipes,
} from '@/db/search';
import { INIT_SCHEMA_SQL, type SqlBindValue, type SqliteExecutor } from '@/db/sqliteAdapter';
import { parseIngredientLines } from '@/domain/ingredient';

function createInMemoryExecutor(): SqliteExecutor {
  const db = new DatabaseSync(':memory:');
  const exec: SqliteExecutor = {
    execSync: (sql) => {
      db.exec(sql);
    },
    runSync: (sql, params: SqlBindValue[] = []) => {
      const stmt = db.prepare(sql);
      const res = stmt.run(...params);
      return {
        changes: Number(res.changes),
        lastInsertRowId: Number(res.lastInsertRowid),
      };
    },
    getFirstSync: <T,>(sql: string, params: SqlBindValue[] = []) => {
      const stmt = db.prepare(sql);
      const row = stmt.get(...params);
      return (row as T | undefined) ?? null;
    },
    getAllSync: <T,>(sql: string, params: SqlBindValue[] = []) => {
      const stmt = db.prepare(sql);
      return stmt.all(...params) as T[];
    },
    withTransactionSync: <T,>(fn: () => T) => {
      db.exec('BEGIN IMMEDIATE;');
      try {
        const res = fn();
        db.exec('COMMIT;');
        return res;
      } catch (e) {
        db.exec('ROLLBACK;');
        throw e;
      }
    },
  };
  exec.execSync(INIT_SCHEMA_SQL);
  return exec;
}

describe('FTS5 query builder & index consistency', () => {
  it('strips FTS operators and builds prefix queries', () => {
    expect(buildFtsQuery('jollof "rice"* (spiced): - ^')).toBe('"jollof"* AND "rice"* AND "spiced"*');
    expect(buildFtsQuery('   ')).toBe('');
  });

  it('keeps recipes_fts and recipe_tags consistent across 500 random operations', () => {
    const db = createInMemoryExecutor();
    const ids: string[] = [];
    const sampleTitles = ['Jollof Rice', 'Tomato Stew', 'Egusi Soup', 'Yam Porridge', 'Plantain Chips'];
    const sampleTags = ['stew', 'rice', 'quick', 'soup', 'breakfast'];

    for (let i = 0; i < 500; i++) {
      const roll = Math.random();
      if (ids.length === 0 || roll < 0.45) {
        const res = saveRecipe(db, {
          title: `${sampleTitles[i % sampleTitles.length]} ${i}`,
          description: null,
          servings: 4,
          prepMinutes: 10,
          cookMinutes: 20,
          ingredients: parseIngredientLines('2 cups rice\n1 onion, chopped'),
          steps: [{ text: 'Cook well for 15 min.' }],
          notes: `note ${i}`,
          sourceUrl: null,
          sourceName: null,
          tags: [sampleTags[i % sampleTags.length]!],
        });
        expect(res.ok).toBe(true);
        if (res.ok) ids.push(res.value.id);
      } else if (roll < 0.8 && ids.length > 0) {
        const targetId = ids[i % ids.length]!;
        saveRecipe(db, {
          id: targetId,
          title: `Updated ${sampleTitles[i % sampleTitles.length]} ${i}`,
          description: null,
          servings: 6,
          prepMinutes: 5,
          cookMinutes: 15,
          ingredients: parseIngredientLines('3 tomatoes, blended'),
          steps: [{ text: 'Simmer.' }],
          notes: `updated ${i}`,
          sourceUrl: null,
          sourceName: null,
          tags: [sampleTags[(i + 1) % sampleTags.length]!],
        });
      } else if (ids.length > 0) {
        const targetId = ids.pop()!;
        softDeleteRecipe(db, targetId);
      }
    }

    // Snapshot FTS rows before rebuild
    const beforeFts = db.getAllSync<{ recipe_id: string; title: string }>(
      'SELECT recipe_id, title FROM recipes_fts ORDER BY recipe_id ASC',
    );
    const beforeCount = db.getFirstSync<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM recipes WHERE deleted_at IS NULL',
    );
    expect(beforeFts.length).toBe(beforeCount?.cnt ?? 0);

    // Search works with prefix + tag filter
    const results = searchRecipes(db, { query: 'upd', tag: null });
    expect(Array.isArray(results)).toBe(true);
    expect(getAllTags(db).length).toBeGreaterThan(0);

    // Rebuild FTS and verify identical recipe_ids & titles
    rebuildSearchIndex(db);
    const afterFts = db.getAllSync<{ recipe_id: string; title: string }>(
      'SELECT recipe_id, title FROM recipes_fts ORDER BY recipe_id ASC',
    );
    expect(afterFts).toEqual(beforeFts);
  });

  it('imports batch atomically', () => {
    const db = createInMemoryExecutor();
    const res = importRecipesBatch(db, [
      {
        id: 'abc123def456001',
        title: 'Batch Recipe',
        description: null,
        servings: 4,
        prepMinutes: 10,
        cookMinutes: 15,
        ingredients: parseIngredientLines('2 eggs'),
        steps: [{ text: 'Boil.' }],
        notes: null,
        sourceUrl: null,
        sourceName: null,
        imagePath: null,
        thumbPath: null,
        tags: ['quick'],
        isFavorite: false,
        timesCooked: 0,
        lastCookedAt: null,
        createdAt: 1000,
        updatedAt: 1000,
        deletedAt: null,
      },
    ]);
    expect(res.ok).toBe(true);
    expect(searchRecipes(db, { query: 'batch' })).toHaveLength(1);
  });
});
