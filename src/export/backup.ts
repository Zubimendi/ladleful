import { CURRENT_BACKUP_SCHEMA_VERSION } from '@/import/backup';
import type { Recipe } from '@/types/recipe';
import type { ShoppingItem, ShoppingList } from '@/types/shopping';

export interface BackupPayload {
  app: 'ladleful';
  schemaVersion: number;
  exportedAt: number;
  recipes: Array<Omit<Recipe, 'imagePath' | 'thumbPath' | 'deletedAt'>>;
  shoppingLists: Array<{
    id: string;
    name: string;
    archived: boolean;
    createdAt: number;
    updatedAt: number;
    items: Array<Omit<ShoppingItem, 'deletedAt'>>;
  }>;
}

export function buildBackupPayload(
  recipes: Recipe[],
  shoppingLists: ShoppingList[],
  shoppingItemsByList: Map<string, ShoppingItem[]>,
  exportedAtMs: number,
): BackupPayload {
  const cleanRecipes = recipes
    .filter((r) => r.deletedAt === null)
    .map(({ imagePath: _img, thumbPath: _thumb, deletedAt: _del, ...rest }) => rest);

  const cleanLists = shoppingLists
    .filter((l) => l.deletedAt === null)
    .map((l) => ({
      id: l.id,
      name: l.name,
      archived: l.archived,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      items: (shoppingItemsByList.get(l.id) ?? [])
        .filter((it) => it.deletedAt === null)
        .map(({ deletedAt: _del, ...itemRest }) => itemRest),
    }));

  return {
    app: 'ladleful',
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAtMs,
    recipes: cleanRecipes,
    shoppingLists: cleanLists,
  };
}

export function serializeBackup(
  recipes: Recipe[],
  shoppingLists: ShoppingList[],
  shoppingItemsByList: Map<string, ShoppingItem[]>,
  exportedAtMs: number,
): string {
  return JSON.stringify(
    buildBackupPayload(recipes, shoppingLists, shoppingItemsByList, exportedAtMs),
    null,
    2,
  );
}
