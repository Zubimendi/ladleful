export type ImportErrorSubtype =
  | 'offline'
  | 'timeout'
  | 'notHtml'
  | 'tooLarge'
  | 'noRecipeData'
  | 'badBackup'
  | 'newerVersion'
  | 'invalidUrl';

export type AppError =
  | { kind: 'network'; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'auth'; message: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'validation'; field?: string; message: string }
  | { kind: 'conflict'; serverRecord?: unknown; message: string }
  | { kind: 'notFound'; message: string }
  | { kind: 'import'; subtype: ImportErrorSubtype; message: string }
  | { kind: 'local'; message: string }
  | { kind: 'unknown'; message: string };

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}
