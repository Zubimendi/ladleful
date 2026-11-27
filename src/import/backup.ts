import { z } from 'zod';
import { generateId, isValidId } from '@/lib/id';
import { err, ok, type AppError, type Result } from '@/lib/result';
import type { Recipe } from '@/types/recipe';
import type { ShoppingItem, ShoppingList } from '@/types/shopping';

export const CURRENT_BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_BACKUP_RECIPES = 5000;

export type ConflictMode = 'skip' | 'replace' | 'keepBoth';

const IngredientSchema = z.object({
  raw: z.string().max(500),
  qty: z.number().min(0).max(100000).nullable(),
  qtyMax: z.number().min(0).max(100000).nullable(),
  unit: z.string().max(40).nullable(),
  name: z.string().max(300),
  note: z.string().max(300).nullable(),
  group: z.string().max(120).nullable(),
  warn: z.boolean(),
});

const StepSchema = z.object({
  text: z.string().max(2000),
});

const BackupRecipeSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional().default(null),
  servings: z.number().positive().max(1000),
  prepMinutes: z.number().int().min(0).max(10080).nullable().optional().default(null),
  cookMinutes: z.number().int().min(0).max(10080).nullable().optional().default(null),
  ingredients: z.array(IngredientSchema).max(300),
  steps: z.array(StepSchema).max(200),
  notes: z.string().max(5000).nullable().optional().default(null),
  sourceUrl: z.string().max(2000).nullable().optional().default(null),
  sourceName: z.string().max(200).nullable().optional().default(null),
  tags: z.array(z.string().max(50)).max(30).optional().default([]),
  isFavorite: z.boolean().optional().default(false),
  timesCooked: z.number().int().min(0).max(100000).optional().default(0),
  lastCookedAt: z.number().nullable().optional().default(null),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const ShoppingSourceSchema = z.object({
  recipeId: z.string(),
  title: z.string().max(200),
  qty: z.number().nullable(),
  unit: z.string().max(40).nullable(),
});

const BackupShoppingItemSchema = z.object({
  id: z.string(),
  listId: z.string(),
  name: z.string().min(1).max(300),
  mergeKey: z.string().max(350),
  quantity: z.number().nullable(),
  unit: z.string().max(40).nullable(),
  aisle: z.enum(['produce', 'grains', 'proteins', 'dairy', 'spices', 'drinks', 'household', 'other']),
  checked: z.boolean(),
  origin: z.enum(['recipe', 'manual']),
  sources: z.array(ShoppingSourceSchema).optional().default([]),
  note: z.string().max(300).nullable().optional().default(null),
  sortOrder: z.number().optional().default(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const BackupShoppingListSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  archived: z.boolean().optional().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
  items: z.array(BackupShoppingItemSchema).max(1000).optional().default([]),
});

export const BackupFileHeaderSchema = z.object({
  app: z.literal('ladleful'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.number(),
});

export const BackupFileSchema = z.object({
  app: z.literal('ladleful'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.number(),
  recipes: z.array(z.unknown()).max(MAX_BACKUP_RECIPES),
  shoppingLists: z.array(z.unknown()).max(200).optional().default([]),
});

export interface BackupImportPlan {
  recipes: Recipe[];
  shoppingLists: Array<{ list: ShoppingList; items: ShoppingItem[] }>;
  newRecipeCount: number;
  existingRecipeCount: number;
  invalidRecipeCount: number;
  listCount: number;
}

export function validateAndPlanBackup(
  rawJson: string,
  existingRecipeIds: Set<string>,
): Result<BackupImportPlan, AppError> {
  if (rawJson.length > MAX_BACKUP_BYTES) {
    return err({
      kind: 'import',
      subtype: 'tooLarge',
      message: 'Backup file is larger than 20 MB.',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return err({
      kind: 'import',
      subtype: 'badBackup',
      message: "This file isn't a valid Ladleful backup.",
    });
  }

  const headerCheck = BackupFileHeaderSchema.safeParse(parsed);
  if (!headerCheck.success) {
    return err({
      kind: 'import',
      subtype: 'badBackup',
      message: "This file isn't a Ladleful backup.",
    });
  }

  if (headerCheck.data.schemaVersion > CURRENT_BACKUP_SCHEMA_VERSION) {
    return err({
      kind: 'import',
      subtype: 'newerVersion',
      message: 'This file was made by a newer version of Ladleful. Update the app to import it.',
    });
  }

  const envelopeCheck = BackupFileSchema.safeParse(parsed);
  if (!envelopeCheck.success) {
    return err({
      kind: 'import',
      subtype: 'badBackup',
      message: 'Backup file structure is invalid or exceeds limits.',
    });
  }

  const validRecipes: Recipe[] = [];
  let newRecipeCount = 0;
  let existingRecipeCount = 0;
  let invalidRecipeCount = 0;

  for (const rawRec of envelopeCheck.data.recipes) {
    const recCheck = BackupRecipeSchema.safeParse(rawRec);
    if (!recCheck.success) {
      invalidRecipeCount += 1;
      continue;
    }
    const r = recCheck.data;
    const id = isValidId(r.id) ? r.id : generateId();
    if (existingRecipeIds.has(id)) {
      existingRecipeCount += 1;
    } else {
      newRecipeCount += 1;
    }

    validRecipes.push({
      id,
      title: r.title,
      description: r.description,
      servings: r.servings,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      ingredients: r.ingredients,
      steps: r.steps,
      notes: r.notes,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
      imagePath: null,
      thumbPath: null,
      tags: r.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
      isFavorite: r.isFavorite,
      timesCooked: r.timesCooked,
      lastCookedAt: r.lastCookedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: null,
    });
  }

  const shoppingLists: Array<{ list: ShoppingList; items: ShoppingItem[] }> = [];
  for (const rawList of envelopeCheck.data.shoppingLists) {
    const listCheck = BackupShoppingListSchema.safeParse(rawList);
    if (!listCheck.success) continue;
    const l = listCheck.data;
    const listId = isValidId(l.id) ? l.id : generateId();
    const list: ShoppingList = {
      id: listId,
      name: l.name,
      archived: l.archived,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      deletedAt: null,
    };
    const items: ShoppingItem[] = l.items.map((it) => ({
      id: isValidId(it.id) ? it.id : generateId(),
      listId,
      name: it.name,
      mergeKey: it.mergeKey,
      quantity: it.quantity,
      unit: it.unit,
      aisle: it.aisle,
      checked: it.checked,
      origin: it.origin,
      sources: it.sources,
      note: it.note,
      sortOrder: it.sortOrder,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
      deletedAt: null,
    }));
    shoppingLists.push({ list, items });
  }

  return ok({
    recipes: validRecipes,
    shoppingLists,
    newRecipeCount,
    existingRecipeCount,
    invalidRecipeCount,
    listCount: shoppingLists.length,
  });
}

export function resolveConflictRecipes(
  planned: Recipe[],
  existingIds: Set<string>,
  mode: ConflictMode,
): Recipe[] {
  const out: Recipe[] = [];
  for (const r of planned) {
    if (!existingIds.has(r.id)) {
      out.push(r);
      continue;
    }
    if (mode === 'skip') {
      continue;
    }
    if (mode === 'replace') {
      out.push(r);
      continue;
    }
    // keepBoth
    out.push({
      ...r,
      id: generateId(),
      title: `${r.title} (imported)`.slice(0, 200),
    });
  }
  return out;
}
