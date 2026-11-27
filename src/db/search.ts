import type { Ingredient, RecipeListItem } from '@/types/recipe';
import type { SqlBindValue, SqliteExecutor } from './sqliteAdapter';

export function buildFtsQuery(rawInput: string): string {
  const cleaned = rawInput
    .toLowerCase()
    .replace(/["*():\-^]/g, ' ')
    .trim();
  if (!cleaned) return '';

  const tokens = cleaned.split(/\s+/).filter(Boolean).slice(0, 8);
  if (tokens.length === 0) return '';

  return tokens.map((tok) => `"${tok}"*`).join(' AND ');
}

export function extractQueryTokens(rawInput: string): string[] {
  return rawInput
    .toLowerCase()
    .replace(/["*():\-^]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

export function buildIngredientsFtsText(ingredients: Ingredient[]): string {
  return ingredients
    .map((i) => `${i.name} ${i.raw}`)
    .join(' ')
    .trim();
}

export function upsertRecipeDerivedIndex(
  db: SqliteExecutor,
  recipeId: string,
  title: string,
  ingredients: Ingredient[],
  tags: string[],
  notes: string | null,
  isDeleted: boolean,
): void {
  db.runSync('DELETE FROM recipe_tags WHERE recipe_id = ?', [recipeId]);
  db.runSync('DELETE FROM recipes_fts WHERE recipe_id = ?', [recipeId]);

  if (isDeleted) return;

  const normalizedTags = Array.from(
    new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
  );

  for (const tag of normalizedTags) {
    db.runSync('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)', [recipeId, tag]);
  }

  db.runSync(
    'INSERT INTO recipes_fts (recipe_id, title, ingredients, tags, notes) VALUES (?, ?, ?, ?, ?)',
    [
      recipeId,
      title,
      buildIngredientsFtsText(ingredients),
      normalizedTags.join(' '),
      notes ?? '',
    ],
  );
}

export function rebuildSearchIndex(db: SqliteExecutor): void {
  db.withTransactionSync(() => {
    // Snapshot existing tags before clearing so FTS tag terms are preserved
    const existingTagRows = db.getAllSync<{ recipe_id: string; tag: string }>(
      'SELECT recipe_id, tag FROM recipe_tags',
    );
    const tagsByRecipe = new Map<string, string[]>();
    for (const tr of existingTagRows) {
      const list = tagsByRecipe.get(tr.recipe_id) ?? [];
      list.push(tr.tag);
      tagsByRecipe.set(tr.recipe_id, list);
    }

    db.execSync('DELETE FROM recipe_tags;');
    db.execSync('DELETE FROM recipes_fts;');

    const rows = db.getAllSync<{
      id: string;
      title: string;
      ingredients: string;
      notes: string | null;
    }>('SELECT id, title, ingredients, notes FROM recipes WHERE deleted_at IS NULL');

    for (const row of rows) {
      let parsedIngs: Ingredient[] = [];
      try {
        parsedIngs = JSON.parse(row.ingredients) as Ingredient[];
      } catch {
        parsedIngs = [];
      }
      const tags = tagsByRecipe.get(row.id) ?? [];

      for (const tag of tags) {
        db.runSync('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)', [row.id, tag]);
      }

      db.runSync(
        'INSERT INTO recipes_fts (recipe_id, title, ingredients, tags, notes) VALUES (?, ?, ?, ?, ?)',
        [row.id, row.title, buildIngredientsFtsText(parsedIngs), tags.join(' '), row.notes ?? ''],
      );
    }
  });
}

export interface SearchFilter {
  query: string;
  favoriteOnly?: boolean;
  under30Only?: boolean;
  tag?: string | null;
  limit?: number;
}

interface RawRecipeSummaryRow {
  id: string;
  title: string;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  thumb_path: string | null;
  is_favorite: number;
  times_cooked: number;
  updated_at: number;
  ingredients: string;
}

export function searchRecipes(db: SqliteExecutor, filter: SearchFilter): RecipeListItem[] {
  const ftsQuery = buildFtsQuery(filter.query);
  const queryTokens = extractQueryTokens(filter.query);
  const limit = filter.limit ?? 200;

  const conditions: string[] = ['r.deleted_at IS NULL'];
  const params: SqlBindValue[] = [];

  if (filter.favoriteOnly) {
    conditions.push('r.is_favorite = 1');
  }
  if (filter.under30Only) {
    conditions.push('(COALESCE(r.prep_minutes, 0) + COALESCE(r.cook_minutes, 0)) > 0 AND (COALESCE(r.prep_minutes, 0) + COALESCE(r.cook_minutes, 0)) <= 30');
  }
  if (filter.tag) {
    conditions.push('EXISTS (SELECT 1 FROM recipe_tags rt WHERE rt.recipe_id = r.id AND rt.tag = ?)');
    params.push(filter.tag.toLowerCase());
  }

  let sql: string;
  if (ftsQuery) {
    sql = `
      SELECT r.id, r.title, r.servings, r.prep_minutes, r.cook_minutes, r.thumb_path,
             r.is_favorite, r.times_cooked, r.updated_at, r.ingredients
      FROM recipes_fts f
      JOIN recipes r ON r.id = f.recipe_id
      WHERE recipes_fts MATCH ? AND ${conditions.join(' AND ')}
      ORDER BY bm25(recipes_fts, 0.0, 10.0, 3.0, 2.0, 1.0)
      LIMIT ?
    `;
    params.unshift(ftsQuery);
    params.push(limit);
  } else {
    sql = `
      SELECT r.id, r.title, r.servings, r.prep_minutes, r.cook_minutes, r.thumb_path,
             r.is_favorite, r.times_cooked, r.updated_at, r.ingredients
      FROM recipes r
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.updated_at DESC
      LIMIT ?
    `;
    params.push(limit);
  }

  const rows = db.getAllSync<RawRecipeSummaryRow>(sql, params);

  // Batch fetch tags for returned recipes
  const tagMap = new Map<string, string[]>();
  if (rows.length > 0) {
    const placeholders = rows.map(() => '?').join(',');
    const tagRows = db.getAllSync<{ recipe_id: string; tag: string }>(
      `SELECT recipe_id, tag FROM recipe_tags WHERE recipe_id IN (${placeholders})`,
      rows.map((r) => r.id),
    );
    for (const tr of tagRows) {
      const list = tagMap.get(tr.recipe_id) ?? [];
      list.push(tr.tag);
      tagMap.set(tr.recipe_id, list);
    }
  }

  return rows.map((row) => {
    let matchedIngredients: string[] | undefined;
    if (queryTokens.length > 0) {
      try {
        const ings = JSON.parse(row.ingredients) as Ingredient[];
        const matches: string[] = [];
        for (const ing of ings) {
          const lower = ing.name.toLowerCase();
          if (queryTokens.some((tok) => lower.includes(tok))) {
            matches.push(ing.name);
            if (matches.length >= 3) break;
          }
        }
        if (matches.length > 0) matchedIngredients = matches;
      } catch {
        // Ignore malformed JSON
      }
    }

    return {
      id: row.id,
      title: row.title,
      servings: row.servings,
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      thumbPath: row.thumb_path,
      isFavorite: row.is_favorite === 1,
      timesCooked: row.times_cooked,
      updatedAt: row.updated_at,
      tags: tagMap.get(row.id) ?? [],
      matchedIngredients,
    };
  });
}

export function getAllTags(db: SqliteExecutor): string[] {
  const rows = db.getAllSync<{ tag: string }>(
    `SELECT DISTINCT rt.tag
     FROM recipe_tags rt
     JOIN recipes r ON r.id = rt.recipe_id
     WHERE r.deleted_at IS NULL
     ORDER BY rt.tag ASC`,
  );
  return rows.map((r) => r.tag);
}
