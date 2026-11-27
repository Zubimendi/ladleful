import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { INIT_SCHEMA_SQL, type SqlBindValue, type SqliteExecutor } from './sqliteAdapter';

let _rawDb: SQLite.SQLiteDatabase | null = null;
let _executor: SqliteExecutor | null = null;
let _initialized = false;

const listeners = new Set<() => void>();

export function notifyDbChanged(): void {
  for (const fn of listeners) {
    fn();
  }
}

export function subscribeDbChanges(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getRawSqlite(): SQLite.SQLiteDatabase {
  if (!_rawDb) {
    _rawDb = SQLite.openDatabaseSync('ladleful.db');
  }
  return _rawDb;
}

export function getDbExecutor(): SqliteExecutor {
  if (_executor) return _executor;
  const raw = getRawSqlite();
  _executor = {
    execSync: (sql) => raw.execSync(sql),
    runSync: (sql, params = []) => {
      const res = raw.runSync(sql, params);
      return { changes: res.changes, lastInsertRowId: res.lastInsertRowId };
    },
    getFirstSync: <T,>(sql: string, params: SqlBindValue[] = []) => {
      return raw.getFirstSync<T>(sql, params) ?? null;
    },
    getAllSync: <T,>(sql: string, params: SqlBindValue[] = []) => {
      return raw.getAllSync<T>(sql, params);
    },
    withTransactionSync: <T,>(fn: () => T) => {
      let result!: T;
      raw.withTransactionSync(() => {
        result = fn();
      });
      return result;
    },
  };
  return _executor;
}

export function ensureDatabaseInitialized(): void {
  if (_initialized) return;
  const exec = getDbExecutor();
  exec.execSync(INIT_SCHEMA_SQL);
  _initialized = true;
}

export function getDrizzleDb() {
  ensureDatabaseInitialized();
  return drizzle(getRawSqlite(), { schema });
}
