export interface DetectedTimer {
  label: string;
  seconds: number;
  start: number;
  end: number;
}

export interface RunningTimer {
  id: string;
  recipeId: string;
  stepIndex: number;
  label: string;
  durationSeconds: number;
  endAt: number | null;
  pausedRemaining: number | null;
  notificationId?: string | null;
  completedNotified?: boolean;
}
