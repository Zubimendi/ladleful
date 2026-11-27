import { now } from '@/lib/clock';
import { generateId } from '@/lib/id';
import { err, ok, type AppError, type Result } from '@/lib/result';
import type { Ingredient, Recipe, Step } from '@/types/recipe';
import { upsertRecipeDerivedIndex } from '../search';
import type { SqliteExecutor } from '../sqliteAdapter';
import { enqueueOutboxIfSignedIn } from './outbox';

interface RawRecipeRow {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: string;
  steps: string;
  notes: string | null;
  source_url: string | null;
  source_name: string | null;
  image_path: string | null;
  thumb_path: string | null;
  is_favorite: number;
  times_cooked: number;
  last_cooked_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

function mapRowToRecipe(db: SqliteExecutor, row: RawRecipeRow): Recipe {
  const tagRows = db.getAllSync<{ tag: string }>(
    'SELECT tag FROM recipe_tags WHERE recipe_id = ? ORDER BY tag ASC',
    [row.id],
  );
  let ingredients: Ingredient[] = [];
  let steps: Step[] = [];
  try {
    ingredients = JSON.parse(row.ingredients) as Ingredient[];
  } catch {
    ingredients = [];
  }
  try {
    steps = JSON.parse(row.steps) as Step[];
  } catch {
    steps = [];
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    servings: row.servings,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    ingredients,
    steps,
    notes: row.notes,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    imagePath: row.image_path,
    thumbPath: row.thumb_path,
    tags: tagRows.map((t) => t.tag),
    isFavorite: row.is_favorite === 1,
    timesCooked: row.times_cooked,
    lastCookedAt: row.last_cooked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function getRecipeById(db: SqliteExecutor, id: string): Recipe | null {
  const row = db.getFirstSync<RawRecipeRow>(
    'SELECT * FROM recipes WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return row ? mapRowToRecipe(db, row) : null;
}

export function getAllRecipes(db: SqliteExecutor): Recipe[] {
  const rows = db.getAllSync<RawRecipeRow>(
    'SELECT * FROM recipes WHERE deleted_at IS NULL ORDER BY updated_at DESC',
  );
  return rows.map((r) => mapRowToRecipe(db, r));
}

export function getExistingRecipeIds(db: SqliteExecutor): Set<string> {
  const rows = db.getAllSync<{ id: string }>(
    'SELECT id FROM recipes WHERE deleted_at IS NULL',
  );
  return new Set(rows.map((r) => r.id));
}

export interface SaveRecipeInput {
  id?: string;
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  notes: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imagePath?: string | null;
  thumbPath?: string | null;
  tags: string[];
  isFavorite?: boolean;
}

export function saveRecipe(
  db: SqliteExecutor,
  input: SaveRecipeInput,
  notify?: () => void,
): Result<Recipe, AppError> {
  const title = input.title.trim();
  if (!title) {
    return err({ kind: 'validation', field: 'title', message: 'Title is required.' });
  }
  if (input.ingredients.length === 0) {
    return err({ kind: 'validation', field: 'ingredients', message: 'Add at least one ingredient.' });
  }

  try {
    const ts = now();
    const isUpdate = Boolean(input.id);
    const id = input.id ?? generateId();

    const saved = db.withTransactionSync(() => {
      const existing = isUpdate
        ? db.getFirstSync<RawRecipeRow>('SELECT * FROM recipes WHERE id = ?', [id])
        : null;

      const createdAt = existing?.created_at ?? ts;
      const isFav = input.isFavorite ?? (existing ? existing.is_favorite === 1 : false);
      const timesCooked = existing?.times_cooked ?? 0;
      const lastCookedAt = existing?.last_cooked_at ?? null;
      const imagePath = input.imagePath !== undefined ? input.imagePath : (existing?.image_path ?? null);
      const thumbPath = input.thumbPath !== undefined ? input.thumbPath : (existing?.thumb_path ?? null);

      db.runSync(
        `INSERT INTO recipes (
          id, title, description, servings, prep_minutes, cook_minutes,
          ingredients, steps, notes, source_url, source_name, image_path, thumb_path,
          is_favorite, times_cooked, last_cooked_at, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
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
          image_path = excluded.image_path,
          thumb_path = excluded.thumb_path,
          is_favorite = excluded.is_favorite,
          updated_at = excluded.updated_at,
          deleted_at = NULL`,
        [
          id,
          title,
          input.description,
          input.servings > 0 ? input.servings : 4,
          input.prepMinutes,
          input.cookMinutes,
          JSON.stringify(input.ingredients),
          JSON.stringify(input.steps),
          input.notes,
          input.sourceUrl,
          input.sourceName,
          imagePath,
          thumbPath,
          isFav ? 1 : 0,
          timesCooked,
          lastCookedAt,
          createdAt,
          ts,
        ],
      );

      upsertRecipeDerivedIndex(db, id, title, input.ingredients, input.tags, input.notes, false);

      const recipeObj: Recipe = {
        id,
        title,
        description: input.description,
        servings: input.servings > 0 ? input.servings : 4,
        prepMinutes: input.prepMinutes,
        cookMinutes: input.cookMinutes,
        ingredients: input.ingredients,
        steps: input.steps,
        notes: input.notes,
        sourceUrl: input.sourceUrl,
        sourceName: input.sourceName,
        imagePath,
        thumbPath,
        tags: Array.from(new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))),
        isFavorite: isFav,
        timesCooked,
        lastCookedAt,
        createdAt,
        updatedAt: ts,
        deletedAt: null,
      };

      enqueueOutboxIfSignedIn(db, 'recipe', id, existing ? 'update' : 'create', recipeObj);
      return recipeObj;
    });

    notify?.();
    return ok(saved);
  } catch {
    return err({ kind: 'local', message: 'Could not save recipe locally.' });
  }
}

export function toggleRecipeFavorite(
  db: SqliteExecutor,
  id: string,
  notify?: () => void,
): Result<boolean, AppError> {
  try {
    const ts = now();
    const next = db.withTransactionSync(() => {
      const existing = getRecipeById(db, id);
      if (!existing) return null;
      const nextFav = !existing.isFavorite;
      db.runSync('UPDATE recipes SET is_favorite = ?, updated_at = ? WHERE id = ?', [
        nextFav ? 1 : 0,
        ts,
        id,
      ]);
      enqueueOutboxIfSignedIn(db, 'recipe', id, 'update', {
        ...existing,
        isFavorite: nextFav,
        updatedAt: ts,
      });
      return nextFav;
    });
    if (next === null) return err({ kind: 'notFound', message: 'Recipe not found.' });
    notify?.();
    return ok(next);
  } catch {
    return err({ kind: 'local', message: 'Could not update favorite.' });
  }
}

export function markRecipeCooked(
  db: SqliteExecutor,
  id: string,
  notify?: () => void,
): Result<number, AppError> {
  try {
    const ts = now();
    const nextCount = db.withTransactionSync(() => {
      const existing = getRecipeById(db, id);
      if (!existing) return null;
      const updatedCount = existing.timesCooked + 1;
      db.runSync(
        'UPDATE recipes SET times_cooked = ?, last_cooked_at = ?, updated_at = ? WHERE id = ?',
        [updatedCount, ts, ts, id],
      );
      enqueueOutboxIfSignedIn(db, 'recipe', id, 'update', {
        ...existing,
        timesCooked: updatedCount,
        lastCookedAt: ts,
        updatedAt: ts,
      });
      return updatedCount;
    });
    if (nextCount === null) return err({ kind: 'notFound', message: 'Recipe not found.' });
    notify?.();
    return ok(nextCount);
  } catch {
    return err({ kind: 'local', message: 'Could not update cooked count.' });
  }
}

export function softDeleteRecipe(
  db: SqliteExecutor,
  id: string,
  notify?: () => void,
): Result<void, AppError> {
  try {
    const ts = now();
    db.withTransactionSync(() => {
      db.runSync('UPDATE recipes SET deleted_at = ?, updated_at = ? WHERE id = ?', [ts, ts, id]);
      upsertRecipeDerivedIndex(db, id, '', [], [], null, true);
      enqueueOutboxIfSignedIn(db, 'recipe', id, 'delete', { id, deletedAt: ts, updatedAt: ts });
    });
    notify?.();
    return ok(undefined);
  } catch {
    return err({ kind: 'local', message: 'Could not delete recipe.' });
  }
}

export function restoreRecipe(
  db: SqliteExecutor,
  recipe: Recipe,
  notify?: () => void,
): Result<void, AppError> {
  try {
    const ts = now();
    db.withTransactionSync(() => {
      db.runSync('UPDATE recipes SET deleted_at = NULL, updated_at = ? WHERE id = ?', [ts, recipe.id]);
      upsertRecipeDerivedIndex(
        db,
        recipe.id,
        recipe.title,
        recipe.ingredients,
        recipe.tags,
        recipe.notes,
        false,
      );
      enqueueOutboxIfSignedIn(db, 'recipe', recipe.id, 'update', {
        ...recipe,
        deletedAt: null,
        updatedAt: ts,
      });
    });
    notify?.();
    return ok(undefined);
  } catch {
    return err({ kind: 'local', message: 'Could not restore recipe.' });
  }
}

export function importRecipesBatch(
  db: SqliteExecutor,
  list: Recipe[],
  notify?: () => void,
): Result<number, AppError> {
  try {
    db.withTransactionSync(() => {
      for (const r of list) {
        db.runSync(
          `INSERT INTO recipes (
            id, title, description, servings, prep_minutes, cook_minutes,
            ingredients, steps, notes, source_url, source_name, image_path, thumb_path,
            is_favorite, times_cooked, last_cooked_at, created_at, updated_at, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
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
            deleted_at = NULL`,
          [
            r.id,
            r.title,
            r.description,
            r.servings,
            r.prepMinutes,
            r.cookMinutes,
            JSON.stringify(r.ingredients),
            JSON.stringify(r.steps),
            r.notes,
            r.sourceUrl,
            r.sourceName,
            r.imagePath,
            r.thumbPath,
            r.isFavorite ? 1 : 0,
            r.timesCooked,
            r.lastCookedAt,
            r.createdAt,
            r.updatedAt,
          ],
        );
        upsertRecipeDerivedIndex(db, r.id, r.title, r.ingredients, r.tags, r.notes, false);
        enqueueOutboxIfSignedIn(db, 'recipe', r.id, 'create', r);
      }
    });
    notify?.();
    return ok(list.length);
  } catch {
    return err({ kind: 'local', message: 'Failed to import recipes.' });
  }
}
