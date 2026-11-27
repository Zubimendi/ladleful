import { classifyAisle } from '@/data/aisles';
import { computeMergeKey, mergeShopping, type IncomingShoppingLine } from '@/domain/shopping';
import { now } from '@/lib/clock';
import { generateId } from '@/lib/id';
import type { Aisle, ShoppingItem, ShoppingList, ShoppingSource } from '@/types/shopping';
import type { SqliteExecutor } from '../sqliteAdapter';
import { enqueueOutboxIfSignedIn } from './outbox';
import { getPantryStaples } from './settings';

interface RawListRow {
  id: string;
  name: string;
  archived: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  item_count?: number;
  unchecked_count?: number;
}

interface RawItemRow {
  id: string;
  list_id: string;
  name: string;
  merge_key: string;
  quantity: number | null;
  unit: string | null;
  aisle: string;
  checked: number;
  origin: 'recipe' | 'manual';
  sources: string | null;
  note: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

function mapList(row: RawListRow): ShoppingList {
  return {
    id: row.id,
    name: row.name,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    itemCount: row.item_count ?? 0,
    uncheckedCount: row.unchecked_count ?? 0,
  };
}

function mapItem(row: RawItemRow): ShoppingItem {
  let sources: ShoppingSource[] = [];
  if (row.sources) {
    try {
      sources = JSON.parse(row.sources) as ShoppingSource[];
    } catch {
      sources = [];
    }
  }
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    mergeKey: row.merge_key,
    quantity: row.quantity,
    unit: row.unit,
    aisle: row.aisle as Aisle,
    checked: row.checked === 1,
    origin: row.origin,
    sources,
    note: row.note,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function getShoppingLists(db: SqliteExecutor, includeArchived = false): ShoppingList[] {
  const archivedFilter = includeArchived ? '' : 'AND sl.archived = 0';
  const rows = db.getAllSync<RawListRow>(
    `SELECT sl.*,
            COUNT(CASE WHEN si.deleted_at IS NULL THEN 1 END) as item_count,
            COUNT(CASE WHEN si.deleted_at IS NULL AND si.checked = 0 THEN 1 END) as unchecked_count
     FROM shopping_lists sl
     LEFT JOIN shopping_items si ON si.list_id = sl.id
     WHERE sl.deleted_at IS NULL ${archivedFilter}
     GROUP BY sl.id
     ORDER BY sl.updated_at DESC`,
  );
  return rows.map(mapList);
}

export function getShoppingListById(db: SqliteExecutor, id: string): ShoppingList | null {
  const row = db.getFirstSync<RawListRow>(
    'SELECT * FROM shopping_lists WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return row ? mapList(row) : null;
}

export function getShoppingItems(db: SqliteExecutor, listId: string): ShoppingItem[] {
  const rows = db.getAllSync<RawItemRow>(
    'SELECT * FROM shopping_items WHERE list_id = ? AND deleted_at IS NULL ORDER BY checked ASC, sort_order ASC, created_at ASC',
    [listId],
  );
  return rows.map(mapItem);
}

export function createShoppingList(
  db: SqliteExecutor,
  name: string,
  notify?: () => void,
): ShoppingList {
  const ts = now();
  const list: ShoppingList = {
    id: generateId(),
    name: name.trim() || 'Shopping list',
    archived: false,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
    itemCount: 0,
    uncheckedCount: 0,
  };

  db.withTransactionSync(() => {
    db.runSync(
      'INSERT INTO shopping_lists (id, name, archived, created_at, updated_at, deleted_at) VALUES (?, ?, 0, ?, ?, NULL)',
      [list.id, list.name, ts, ts],
    );
    enqueueOutboxIfSignedIn(db, 'shopping_list', list.id, 'create', list);
  });

  notify?.();
  return list;
}

export function renameShoppingList(
  db: SqliteExecutor,
  listId: string,
  name: string,
  notify?: () => void,
): void {
  const ts = now();
  db.withTransactionSync(() => {
    db.runSync('UPDATE shopping_lists SET name = ?, updated_at = ? WHERE id = ?', [
      name.trim(),
      ts,
      listId,
    ]);
    const list = getShoppingListById(db, listId);
    if (list) enqueueOutboxIfSignedIn(db, 'shopping_list', listId, 'update', list);
  });
  notify?.();
}

export function archiveShoppingList(
  db: SqliteExecutor,
  listId: string,
  archived = true,
  notify?: () => void,
): void {
  const ts = now();
  db.withTransactionSync(() => {
    db.runSync('UPDATE shopping_lists SET archived = ?, updated_at = ? WHERE id = ?', [
      archived ? 1 : 0,
      ts,
      listId,
    ]);
    const list = getShoppingListById(db, listId);
    if (list) enqueueOutboxIfSignedIn(db, 'shopping_list', listId, 'update', list);
  });
  notify?.();
}

export function addManualShoppingItem(
  db: SqliteExecutor,
  listId: string,
  name: string,
  notify?: () => void,
): ShoppingItem {
  const ts = now();
  const trimmed = name.trim();
  const item: ShoppingItem = {
    id: generateId(),
    listId,
    name: trimmed,
    mergeKey: computeMergeKey(trimmed, null),
    quantity: null,
    unit: null,
    aisle: classifyAisle(trimmed),
    checked: false,
    origin: 'manual',
    sources: [],
    note: null,
    sortOrder: ts,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO shopping_items (
        id, list_id, name, merge_key, quantity, unit, aisle, checked, origin, sources, note, sort_order, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'manual', '[]', NULL, ?, ?, ?, NULL)`,
      [item.id, listId, item.name, item.mergeKey, null, null, item.aisle, item.sortOrder, ts, ts],
    );
    db.runSync('UPDATE shopping_lists SET updated_at = ? WHERE id = ?', [ts, listId]);
    enqueueOutboxIfSignedIn(db, 'shopping_item', item.id, 'create', item);
  });

  notify?.();
  return item;
}

export function toggleShoppingItemChecked(
  db: SqliteExecutor,
  itemId: string,
  notify?: () => void,
): void {
  const ts = now();
  db.withTransactionSync(() => {
    const row = db.getFirstSync<RawItemRow>('SELECT * FROM shopping_items WHERE id = ?', [itemId]);
    if (!row) return;
    const next = row.checked === 1 ? 0 : 1;
    db.runSync('UPDATE shopping_items SET checked = ?, updated_at = ? WHERE id = ?', [
      next,
      ts,
      itemId,
    ]);
    db.runSync('UPDATE shopping_lists SET updated_at = ? WHERE id = ?', [ts, row.list_id]);
    const item = mapItem({ ...row, checked: next, updated_at: ts });
    enqueueOutboxIfSignedIn(db, 'shopping_item', itemId, 'update', item);
  });
  notify?.();
}

export function clearCheckedShoppingItems(
  db: SqliteExecutor,
  listId: string,
  notify?: () => void,
): void {
  const ts = now();
  db.withTransactionSync(() => {
    const checkedRows = db.getAllSync<RawItemRow>(
      'SELECT * FROM shopping_items WHERE list_id = ? AND checked = 1 AND deleted_at IS NULL',
      [listId],
    );
    db.runSync(
      'UPDATE shopping_items SET deleted_at = ?, updated_at = ? WHERE list_id = ? AND checked = 1 AND deleted_at IS NULL',
      [ts, ts, listId],
    );
    db.runSync('UPDATE shopping_lists SET updated_at = ? WHERE id = ?', [ts, listId]);
    for (const r of checkedRows) {
      enqueueOutboxIfSignedIn(db, 'shopping_item', r.id, 'delete', {
        id: r.id,
        deletedAt: ts,
        updatedAt: ts,
      });
    }
  });
  notify?.();
}

export function addRecipesToShoppingList(
  db: SqliteExecutor,
  listId: string,
  lines: IncomingShoppingLine[],
  notify?: () => void,
): { addedCount: number; combinedCount: number; skippedCount: number } {
  const ts = now();
  const pantry = getPantryStaples(db);
  const existing = getShoppingItems(db, listId);
  const merged = mergeShopping(existing, lines, pantry, ts);

  db.withTransactionSync(() => {
    for (const u of merged.updatedItems) {
      db.runSync(
        'UPDATE shopping_items SET quantity = ?, unit = ?, checked = ?, sources = ?, updated_at = ? WHERE id = ?',
        [u.quantity, u.unit, u.checked ? 1 : 0, JSON.stringify(u.sources), u.updatedAt, u.id],
      );
      enqueueOutboxIfSignedIn(db, 'shopping_item', u.id, 'update', u);
    }

    for (const n of merged.newItems) {
      const id = generateId();
      db.runSync(
        `INSERT INTO shopping_items (
          id, list_id, name, merge_key, quantity, unit, aisle, checked, origin, sources, note, sort_order, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'recipe', ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          listId,
          n.name,
          n.mergeKey,
          n.quantity,
          n.unit,
          n.aisle,
          JSON.stringify(n.sources),
          n.note,
          ts,
          ts,
          ts,
        ],
      );
      enqueueOutboxIfSignedIn(db, 'shopping_item', id, 'create', {
        id,
        listId,
        ...n,
        checked: false,
        sortOrder: ts,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
      });
    }

    db.runSync('UPDATE shopping_lists SET updated_at = ? WHERE id = ?', [ts, listId]);
  });

  notify?.();
  return {
    addedCount: merged.addedCount,
    combinedCount: merged.combinedCount,
    skippedCount: merged.skippedCount,
  };
}
