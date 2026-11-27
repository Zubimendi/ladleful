import type { DetectedTimer, RunningTimer } from '@/types/timer';

const TIMER_REGEX =
  /\b(\d+(?:\.\d+)?)(?:\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/gi;

function unitToSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 3600;
  if (u.startsWith('m')) return 60;
  return 1;
}

function shortUnitLabel(unit: string): string {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return 'hr';
  if (u.startsWith('m')) return 'min';
  return 'sec';
}

export function detectTimers(stepText: string): DetectedTimer[] {
  const results: DetectedTimer[] = [];
  const regex = new RegExp(TIMER_REGEX.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(stepText)) !== null) {
    const low = Number(match[1]);
    const high = match[2] !== undefined ? Number(match[2]) : low;
    const unit = match[3]!;
    if (!Number.isFinite(high) || high <= 0) continue;

    // Avoid false positives for single-letter "m" or "s" unless clearly a duration > 0
    const seconds = Math.round(high * unitToSeconds(unit));
    if (seconds <= 0) continue;

    const labelNum = match[2] !== undefined ? `${low}-${high}` : `${low}`;
    results.push({
      label: `${labelNum} ${shortUnitLabel(unit)}`,
      seconds,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return results;
}

export function getRemainingSeconds(timer: RunningTimer, nowMs: number): number {
  if (timer.pausedRemaining !== null) {
    return Math.max(0, Math.ceil(timer.pausedRemaining));
  }
  if (timer.endAt === null) {
    return 0;
  }
  return Math.max(0, Math.ceil((timer.endAt - nowMs) / 1000));
}

export function isTimerDone(timer: RunningTimer, nowMs: number): boolean {
  return timer.pausedRemaining === null && timer.endAt !== null && nowMs >= timer.endAt;
}
