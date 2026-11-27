import { formatCountdown, formatMinutes, parseIsoDurationMinutes } from '@/domain/duration';
import { detectTimers, getRemainingSeconds, isTimerDone } from '@/domain/timers';
import type { RunningTimer } from '@/types/timer';

describe('duration', () => {
  it('parses ISO 8601 durations', () => {
    expect(parseIsoDurationMinutes('PT1H15M')).toBe(75);
    expect(parseIsoDurationMinutes('PT45M')).toBe(45);
    expect(parseIsoDurationMinutes('P0DT1H30M')).toBe(90);
    expect(parseIsoDurationMinutes('PT90S')).toBe(2);
    expect(parseIsoDurationMinutes('')).toBeNull();
  });

  it('formats minutes and countdowns', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(75)).toBe('1h 15m');
    expect(formatCountdown(95)).toBe('01:35');
    expect(formatCountdown(3665)).toBe('1:01:05');
  });
});

describe('detectTimers', () => {
  it('detects single durations and ranges using the upper bound', () => {
    const timers = detectTimers('Simmer for 15-20 minutes, then rest 5 min.');
    expect(timers).toHaveLength(2);
    expect(timers[0]).toMatchObject({ label: '15-20 min', seconds: 1200 });
    expect(timers[1]).toMatchObject({ label: '5 min', seconds: 300 });
  });

  it('detects hours and seconds', () => {
    const timers = detectTimers('Bake for 1.5 hours and broil 45 sec.');
    expect(timers).toHaveLength(2);
    expect(timers[0]?.seconds).toBe(5400);
    expect(timers[1]?.seconds).toBe(45);
  });
});

describe('running timer remaining time', () => {
  it('computes remaining time from absolute endAt and handles pause', () => {
    const running: RunningTimer = {
      id: 't1',
      recipeId: 'r1',
      stepIndex: 0,
      label: '10 min',
      durationSeconds: 600,
      endAt: 100_000 + 600_000,
      pausedRemaining: null,
    };
    expect(getRemainingSeconds(running, 100_000 + 120_000)).toBe(480);
    expect(isTimerDone(running, 100_000 + 600_000)).toBe(true);

    const paused: RunningTimer = { ...running, endAt: null, pausedRemaining: 320 };
    expect(getRemainingSeconds(paused, 999_999)).toBe(320);
    expect(isTimerDone(paused, 999_999)).toBe(false);
  });
});
