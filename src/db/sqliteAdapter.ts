export type SqlBindValue = string | number | null;

export interface SqliteExecutor {
  execSync(sql: string): void;
  runSync(sql: string, params?: SqlBindValue[]): { changes: number; lastInsertRowId: number };
  getFirstSync<T>(sql: string, params?: SqlBindValue[]): T | null;
  getAllSync<T>(sql: string, params?: SqlBindValue[]): T[];
  withTransactionSync<T>(fn: () => T): T;
}

export const INIT_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  servings REAL NOT NULL DEFAULT 4,
  prep_minutes INTEGER,
  cook_minutes INTEGER,
  ingredients TEXT NOT NULL,
  steps TEXT NOT NULL,
  notes TEXT,
  source_url TEXT,
  source_name TEXT,
  image_path TEXT,
  thumb_path TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  times_cooked INTEGER NOT NULL DEFAULT 0,
  last_cooked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_recipes_list ON recipes(deleted_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS recipe_tags (
  recipe_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (recipe_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON recipe_tags(tag);

CREATE VIRTUAL TABLE IF NOT EXISTS recipes_fts USING fts5(
  recipe_id UNINDEXED,
  title,
  ingredients,
  tags,
  notes,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id),
  name TEXT NOT NULL,
  merge_key TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  aisle TEXT NOT NULL DEFAULT 'other',
  checked INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL CHECK (origin IN ('recipe','manual')),
  sources TEXT,
  note TEXT,
  sort_order REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_items_list ON shopping_items(list_id, deleted_at, aisle);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL CHECK (entity IN ('recipe','shopping_list','shopping_item')),
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('create','update','delete')),
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','parked')),
  last_error TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
