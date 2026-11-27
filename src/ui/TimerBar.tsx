import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatCountdown } from '@/domain/duration';
import { getRemainingSeconds, isTimerDone } from '@/domain/timers';
import { now } from '@/lib/clock';
import { useTimerStore } from '@/stores/timerStore';
import { RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from './tokens';
import { useTheme } from './ThemeContext';

export function TimerBar({ recipeId }: { recipeId?: string }) {
  const { colors } = useTheme();
  const timers = useTimerStore((s) => s.timers);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const cancelTimer = useTimerStore((s) => s.cancelTimer);
  const markCompletedNotified = useTimerStore((s) => s.markCompletedNotified);
  const [tick, setTick] = useState(0);

  const visibleTimers = recipeId ? timers.filter((t) => t.recipeId === recipeId) : timers;

  useEffect(() => {
    if (visibleTimers.length === 0) return;
    const interval = setInterval(() => {
      setTick((n) => n + 1);
      const tNow = now();
      for (const t of visibleTimers) {
        if (isTimerDone(t, tNow) && !t.completedNotified) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          markCompletedNotified(t.id);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [visibleTimers.length, markCompletedNotified]);

  if (visibleTimers.length === 0) return null;

  const tNow = now() + tick * 0;

  return (
    <View style={{ gap: SPACING.sm }}>
      {visibleTimers.map((t) => {
        const rem = getRemainingSeconds(t, tNow);
        const done = rem === 0 && t.pausedRemaining === null;
        const paused = t.pausedRemaining !== null;

        return (
          <View
            key={t.id}
            style={[
              styles.bar,
              {
                backgroundColor: done ? colors.accentSoft : colors.surface,
                borderColor: done ? colors.accent : colors.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>
                {done ? 'Timer done' : paused ? 'Paused' : 'Running'} · {t.label}
              </Text>
              <Text
                style={[
                  TYPOGRAPHY.heading,
                  {
                    color: done ? colors.accent : colors.text,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {done ? '00:00' : formatCountdown(rem)}
              </Text>
            </View>

            {!done ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={paused ? 'Resume timer' : 'Pause timer'}
                onPress={() => {
                  void Haptics.selectionAsync();
                  if (paused) resumeTimer(t.id);
                  else pauseTimer(t.id);
                }}
                style={[styles.iconBtn, { backgroundColor: colors.primarySoft }]}
              >
                <Ionicons name={paused ? 'play' : 'pause'} size={20} color={colors.primary} />
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel timer"
              onPress={() => {
                void Haptics.selectionAsync();
                cancelTimer(t.id);
              }}
              style={[styles.iconBtn, { backgroundColor: colors.dangerSoft, marginLeft: SPACING.sm }]}
            >
              <Ionicons name="close" size={20} color={colors.danger} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: TOUCH_TARGET.min,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
