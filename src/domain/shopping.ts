import { classifyAisle } from '@/data/aisles';
import type { Ingredient } from '@/types/recipe';
import type { Aisle, ShoppingItem, ShoppingSource } from '@/types/shopping';
import { fromFamilyBase, getUnitFamily, toFamilyBase } from './units';

export function normalizeIngredientName(name: string): string {
  const base = name.split(',')[0] ?? name;
  const tokens = base
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (word.length > 3 && !word.endsWith('ss')) {
        if (word.endsWith('es') && !word.endsWith('oes')) {
          return word.slice(0, -2);
        }
        if (word.endsWith('oes')) {
          return word.slice(0, -2);
        }
        if (word.endsWith('s')) {
          return word.slice(0, -1);
        }
      }
      return word;
    });
  return tokens.join(' ').trim();
}

export function computeMergeKey(name: string, unit: string | null): string {
  const norm = normalizeIngredientName(name);
  const family = getUnitFamily(unit);
  if (family === 'other') {
    return `${norm}::other:${(unit ?? '').toLowerCase()}`;
  }
  return `${norm}::${family}`;
}

export interface IncomingShoppingLine {
  ingredient: Ingredient;
  recipeId: string;
  recipeTitle: string;
}

export interface MergeShoppingResult {
  updatedItems: ShoppingItem[];
  newItems: Array<{
    name: string;
    mergeKey: string;
    quantity: number | null;
    unit: string | null;
    aisle: Aisle;
    origin: 'recipe';
    sources: ShoppingSource[];
    note: string | null;
  }>;
  addedCount: number;
  combinedCount: number;
  skippedCount: number;
}

export function mergeShopping(
  existingItems: ShoppingItem[],
  incomingLines: IncomingShoppingLine[],
  pantryStaples: string[],
  nowMs: number,
): MergeShoppingResult {
  const pantrySet = new Set(pantryStaples.map((p) => normalizeIngredientName(p)).filter(Boolean));

  const updatedMap = new Map<string, ShoppingItem>();
  for (const item of existingItems) {
    updatedMap.set(item.id, { ...item, sources: [...item.sources] });
  }

  // Index existing recipe-origin items by mergeKey
  const existingByKey = new Map<string, ShoppingItem>();
  for (const item of updatedMap.values()) {
    if (item.origin === 'recipe' && item.deletedAt === null) {
      existingByKey.set(item.mergeKey, item);
    }
  }

  const pendingNewByKey = new Map<
    string,
    {
      name: string;
      mergeKey: string;
      quantity: number | null;
      unit: string | null;
      aisle: Aisle;
      origin: 'recipe';
      sources: ShoppingSource[];
      note: string | null;
    }
  >();

  let skippedCount = 0;
  let combinedCount = 0;
  let addedCount = 0;

  for (const line of incomingLines) {
    const { ingredient, recipeId, recipeTitle } = line;
    const normName = normalizeIngredientName(ingredient.name);
    if (!normName) continue;

    if (pantrySet.has(normName)) {
      skippedCount += 1;
      continue;
    }

    const qty = ingredient.qtyMax ?? ingredient.qty;
    const unit = ingredient.unit;
    const mergeKey = computeMergeKey(ingredient.name, unit);
    const sourceEntry: ShoppingSource = {
      recipeId,
      title: recipeTitle,
      qty,
      unit,
    };

    const existing = existingByKey.get(mergeKey);
    if (existing) {
      combinedCount += 1;
      existing.sources.push(sourceEntry);
      existing.checked = false;
      existing.updatedAt = nowMs;

      if (existing.quantity !== null && qty !== null) {
        const b1 = toFamilyBase(existing.quantity, existing.unit);
        const b2 = toFamilyBase(qty, unit);
        if (b1.family === b2.family) {
          const converted = fromFamilyBase(b1.value + b2.value, b1.family, existing.unit ?? unit);
          existing.quantity = converted.qty;
          existing.unit = converted.unit;
        }
      }
      continue;
    }

    const pendingNew = pendingNewByKey.get(mergeKey);
    if (pendingNew) {
      combinedCount += 1;
      pendingNew.sources.push(sourceEntry);
      if (pendingNew.quantity !== null && qty !== null) {
        const b1 = toFamilyBase(pendingNew.quantity, pendingNew.unit);
        const b2 = toFamilyBase(qty, unit);
        if (b1.family === b2.family) {
          const converted = fromFamilyBase(b1.value + b2.value, b1.family, pendingNew.unit ?? unit);
          pendingNew.quantity = converted.qty;
          pendingNew.unit = converted.unit;
        }
      }
      continue;
    }

    addedCount += 1;
    pendingNewByKey.set(mergeKey, {
      name: ingredient.name,
      mergeKey,
      quantity: qty,
      unit,
      aisle: classifyAisle(ingredient.name),
      origin: 'recipe',
      sources: [sourceEntry],
      note: ingredient.note,
    });
  }

  return {
    updatedItems: Array.from(updatedMap.values()),
    newItems: Array.from(pendingNewByKey.values()),
    addedCount,
    combinedCount,
    skippedCount,
  };
}
