import { index, integer, real, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const recipes = sqliteTable(
  'recipes',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    servings: real('servings').notNull().default(4),
    prepMinutes: integer('prep_minutes'),
    cookMinutes: integer('cook_minutes'),
    ingredients: text('ingredients').notNull(), // JSON Ingredient[]
    steps: text('steps').notNull(), // JSON Step[]
    notes: text('notes'),
    sourceUrl: text('source_url'),
    sourceName: text('source_name'),
    imagePath: text('image_path'),
    thumbPath: text('thumb_path'),
    isFavorite: integer('is_favorite').notNull().default(0),
    timesCooked: integer('times_cooked').notNull().default(0),
    lastCookedAt: integer('last_cooked_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [index('idx_recipes_list').on(table.deletedAt, table.updatedAt)],
);

export const recipeTags = sqliteTable(
  'recipe_tags',
  {
    recipeId: text('recipe_id').notNull(),
    tag: text('tag').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.tag] }),
    index('idx_tags_tag').on(table.tag),
  ],
);

export const shoppingLists = sqliteTable('shopping_lists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  archived: integer('archived').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const shoppingItems = sqliteTable(
  'shopping_items',
  {
    id: text('id').primaryKey(),
    listId: text('list_id')
      .notNull()
      .references(() => shoppingLists.id),
    name: text('name').notNull(),
    mergeKey: text('merge_key').notNull(),
    quantity: real('quantity'),
    unit: text('unit'),
    aisle: text('aisle').notNull().default('other'),
    checked: integer('checked').notNull().default(0),
    origin: text('origin').notNull(), // 'recipe' | 'manual'
    sources: text('sources'), // JSON ShoppingSource[]
    note: text('note'),
    sortOrder: real('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [index('idx_items_list').on(table.listId, table.deletedAt, table.aisle)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const outbox = sqliteTable('outbox', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  entity: text('entity').notNull(), // 'recipe' | 'shopping_list' | 'shopping_item'
  entityId: text('entity_id').notNull(),
  op: text('op').notNull(), // 'create' | 'update' | 'delete'
  payload: text('payload').notNull(),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: integer('next_attempt_at').notNull().default(0),
  status: text('status').notNull().default('pending'), // 'pending' | 'parked'
  lastError: text('last_error'),
  createdAt: integer('created_at').notNull(),
});

export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
