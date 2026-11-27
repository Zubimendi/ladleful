import { create } from 'zustand';
import { getDbExecutor } from '@/db/client';
import { getActiveTimers, setActiveTimers } from '@/db/repositories/settings';
import { now } from '@/lib/clock';
import { generateId } from '@/lib/id';
import type { RunningTimer } from '@/types/timer';

interface TimerState {
  timers: RunningTimer[];
  loaded: boolean;
  loadTimers: () => void;
  startTimer: (params: {
    recipeId: string;
    stepIndex: number;
    label: string;
    durationSeconds: number;
    notificationId?: string | null;
  }) => RunningTimer;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string, notificationId?: string | null) => void;
  cancelTimer: (id: string) => void;
  markCompletedNotified: (id: string) => void;
}

function persist(timers: RunningTimer[]) {
  try {
    setActiveTimers(getDbExecutor(), timers);
  } catch {
    // Ignore in non-DB environments
  }
}

export const useTimerStore = create<TimerState>((set, get) => ({
  timers: [],
  loaded: false,

  loadTimers: () => {
    if (get().loaded) return;
    try {
      const saved = getActiveTimers(getDbExecutor());
      set({ timers: saved, loaded: true });
    } catch {
      set({ timers: [], loaded: true });
    }
  },

  startTimer: ({ recipeId, stepIndex, label, durationSeconds, notificationId }) => {
    const timer: RunningTimer = {
      id: generateId(),
      recipeId,
      stepIndex,
      label,
      durationSeconds,
      endAt: now() + durationSeconds * 1000,
      pausedRemaining: null,
      notificationId: notificationId ?? null,
      completedNotified: false,
    };
    const next = [...get().timers, timer];
    set({ timers: next });
    persist(next);
    return timer;
  },

  pauseTimer: (id) => {
    const tNow = now();
    const next = get().timers.map((t) => {
      if (t.id !== id || t.pausedRemaining !== null || t.endAt === null) return t;
      const rem = Math.max(0, Math.ceil((t.endAt - tNow) / 1000));
      return { ...t, endAt: null, pausedRemaining: rem, notificationId: null };
    });
    set({ timers: next });
    persist(next);
  },

  resumeTimer: (id, notificationId) => {
    const tNow = now();
    const next = get().timers.map((t) => {
      if (t.id !== id || t.pausedRemaining === null) return t;
      return {
        ...t,
        endAt: tNow + t.pausedRemaining * 1000,
        pausedRemaining: null,
        notificationId: notificationId ?? null,
      };
    });
    set({ timers: next });
    persist(next);
  },

  cancelTimer: (id) => {
    const next = get().timers.filter((t) => t.id !== id);
    set({ timers: next });
    persist(next);
  },

  markCompletedNotified: (id) => {
    const next = get().timers.map((t) =>
      t.id === id ? { ...t, completedNotified: true } : t,
    );
    set({ timers: next });
    persist(next);
  },
}));
