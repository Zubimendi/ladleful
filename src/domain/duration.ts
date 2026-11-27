/**
 * Parse ISO 8601 durations (e.g., "PT1H15M", "PT30M", "P0DT0H45M") into minutes.
 */
export function parseIsoDurationMinutes(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? Math.round(input) : null;
  }
  const s = input.trim().toUpperCase();
  if (!s) return null;

  const isoMatch = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (isoMatch) {
    const days = Number(isoMatch[1] ?? 0);
    const hours = Number(isoMatch[2] ?? 0);
    const mins = Number(isoMatch[3] ?? 0);
    const secs = Number(isoMatch[4] ?? 0);
    const total = days * 1440 + hours * 60 + mins + Math.round(secs / 60);
    return total > 0 ? total : null;
  }

  // Fallback plain number of minutes
  const numMatch = s.match(/^(\d+)\s*(?:MIN|MINS|MINUTE|MINUTES)?$/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    return n > 0 ? n : null;
  }

  return null;
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}
