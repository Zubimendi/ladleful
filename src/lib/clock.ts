export interface Clock {
  now(): number;
}

const systemClock: Clock = {
  now: () => Date.now(),
};

let activeClock: Clock = systemClock;

export function now(): number {
  return activeClock.now();
}

export function setClock(clock: Clock): void {
  activeClock = clock;
}

export function resetClock(): void {
  activeClock = systemClock;
}
