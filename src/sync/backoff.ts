const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 300_000; // 5 minutes

export function computeBackoffMs(attempts: number, jitterRandom = Math.random()): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts)));
  const jitterFactor = 0.8 + jitterRandom * 0.4; // +/- 20%
  return Math.round(exp * jitterFactor);
}
