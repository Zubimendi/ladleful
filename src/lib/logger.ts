/**
 * Structured logger that only records safe metadata (ids, counts, error classes).
 * Never log recipe content, URLs, notes, or emails.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  id?: string;
  count?: number;
  errorClass?: string;
  durationMs?: number;
  op?: string;
}

export interface Logger {
  debug(event: string, meta?: LogMeta): void;
  info(event: string, meta?: LogMeta): void;
  warn(event: string, meta?: LogMeta): void;
  error(event: string, meta?: LogMeta): void;
}

function emit(level: LogLevel, event: string, meta?: LogMeta): void {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (isDev || level === 'error' || level === 'warn') {
    const safeMeta = meta
      ? {
          ...(meta.id !== undefined ? { id: meta.id } : {}),
          ...(meta.count !== undefined ? { count: meta.count } : {}),
          ...(meta.errorClass !== undefined ? { errorClass: meta.errorClass } : {}),
          ...(meta.durationMs !== undefined ? { durationMs: meta.durationMs } : {}),
          ...(meta.op !== undefined ? { op: meta.op } : {}),
        }
      : undefined;
    const prefix = `[ladleful:${level}] ${event}`;
    if (level === 'error') {
      console.error(prefix, safeMeta ?? '');
    } else if (level === 'warn') {
      console.warn(prefix, safeMeta ?? '');
    } else {
      console.log(prefix, safeMeta ?? '');
    }
  }
}

export const logger: Logger = {
  debug: (event, meta) => emit('debug', event, meta),
  info: (event, meta) => emit('info', event, meta),
  warn: (event, meta) => emit('warn', event, meta),
  error: (event, meta) => emit('error', event, meta),
};
