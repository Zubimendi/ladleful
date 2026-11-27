import type { RunningTimer } from '@/types/timer';
import type { SqliteExecutor } from '../sqliteAdapter';

export type ThemePreference = 'system' | 'light' | 'dark';

export const DEFAULT_PANTRY_STAPLES = ['salt', 'water', 'black pepper'];

export function getSetting(db: SqliteExecutor, key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setSetting(db: SqliteExecutor, key: string, value: string): void {
  db.runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export function deleteSetting(db: SqliteExecutor, key: string): void {
  db.runSync('DELETE FROM settings WHERE key = ?', [key]);
}

export function getThemePreference(db: SqliteExecutor): ThemePreference {
  const val = getSetting(db, 'theme');
  if (val === 'light' || val === 'dark' || val === 'system') return val;
  return 'system';
}

export function setThemePreference(db: SqliteExecutor, theme: ThemePreference): void {
  setSetting(db, 'theme', theme);
}

export function getPantryStaples(db: SqliteExecutor): string[] {
  const raw = getSetting(db, 'pantry_staples');
  if (!raw) return DEFAULT_PANTRY_STAPLES;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : DEFAULT_PANTRY_STAPLES;
  } catch {
    return DEFAULT_PANTRY_STAPLES;
  }
}

export function setPantryStaples(db: SqliteExecutor, staples: string[]): void {
  setSetting(db, 'pantry_staples', JSON.stringify(staples));
}

export function getActiveTimers(db: SqliteExecutor): RunningTimer[] {
  const raw = getSetting(db, 'active_timers');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RunningTimer[]) : [];
  } catch {
    return [];
  }
}

export function setActiveTimers(db: SqliteExecutor, timers: RunningTimer[]): void {
  setSetting(db, 'active_timers', JSON.stringify(timers));
}

export function hasCompletedOnboarding(db: SqliteExecutor): boolean {
  return getSetting(db, 'onboarding_done') === '1';
}

export function markOnboardingCompleted(db: SqliteExecutor): void {
  setSetting(db, 'onboarding_done', '1');
}
