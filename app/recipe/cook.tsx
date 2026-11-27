import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import { getDbExecutor } from '@/db/client';
import { getRecipeById } from '@/db/repositories/recipes';
import { formatQuantity } from '@/domain/quantity';
import { scaleIngredients } from '@/domain/scale';
import { detectTimers } from '@/domain/timers';
import { useTimerStore } from '@/stores/timerStore';
import { Button, Card, Chip, EmptyState, Screen } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { TimerBar } from '@/ui/TimerBar';
import { RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function CookingModeScreen() {
  useKeepAwake();

  const { id, servings: servingsParam } = useLocalSearchParams<{
    id: string;
    servings?: string;
  }>();
  const router = useRouter();
  const { colors } = useTheme();
  const startTimer = useTimerStore((s) => s.startTimer);

  const recipe = useMemo(() => (id ? getRecipeById(getDbExecutor(), id) : null), [id]);
  const [stepIdx, setStepIdx] = useState(0);
  const [ingSheetOpen, setIngSheetOpen] = useState(false);

  const targetServings = Number(servingsParam) || recipe?.servings || 4;
  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    return scaleIngredients(recipe.ingredients, recipe.servings, targetServings);
  }, [recipe, targetServings]);

  if (!recipe || recipe.steps.length === 0) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          icon={<Ionicons name="flame-outline" size={28} color={colors.primary} />}
          title="No steps to cook"
          subtitle="Add steps to this recipe to use cooking mode."
        >
          <Button title="Close" onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  const totalSteps = recipe.steps.length;
  const currentStep = recipe.steps[stepIdx] ?? { text: '' };
  const detectedTimers = detectTimers(currentStep.text);

  const handleStartTimer = async (label: string, seconds: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let notificationId: string | null = null;
    try {
      const perms = await Notifications.getPermissionsAsync();
      if (perms.granted) {
        notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${recipe.title} · Timer done`,
            body: `${label} timer finished.`,
            sound: true,
            data: { recipeId: recipe.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
          },
        });
      }
    } catch {
      // Notifications are P1 enhancement; in-app timer still runs
    }

    startTimer({
      recipeId: recipe.id,
      stepIndex: stepIdx,
      label,
      durationSeconds: seconds,
      notificationId,
    });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit cooking mode"
          onPress={() => router.back()}
          style={[styles.topBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {recipe.title}
          </Text>
          <Text style={[TYPOGRAPHY.label, { color: colors.text }]}>
            Step {stepIdx + 1} of {totalSteps}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View ingredients"
          onPress={() => setIngSheetOpen(true)}
          style={[styles.topBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
        >
          <Ionicons name="list" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* Progress Dots */}
      <View style={styles.dotsRow}>
        {recipe.steps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === stepIdx ? colors.primary : colors.border,
                width: i === stepIdx ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Running Timers */}
      <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.sm }}>
        <TimerBar recipeId={recipe.id} />
      </View>

      {/* Step Card */}
      <ScrollView contentContainerStyle={styles.stepContainer}>
        <Card style={styles.stepCard}>
          <Text style={[TYPOGRAPHY.cookStep, { color: colors.text }]}>{currentStep.text}</Text>

          {detectedTimers.length > 0 ? (
            <View style={styles.timersWrap}>
              {detectedTimers.map((t, idx) => (
                <Chip
                  key={`${t.label}-${idx}`}
                  label={`Start ${t.label} timer`}
                  onPress={() => handleStartTimer(t.label, t.seconds)}
                  icon={<Ionicons name="timer-outline" size={16} color={colors.accent} />}
                />
              ))}
            </View>
          ) : null}
        </Card>
      </ScrollView>

      {/* 64dp Kitchen Controls */}
      <View style={styles.controlsRow}>
        <Button
          title="Back"
          variant="secondary"
          size="cook"
          disabled={stepIdx === 0}
          onPress={() => setStepIdx((i) => Math.max(0, i - 1))}
          style={{ flex: 1 }}
        />
        {stepIdx < totalSteps - 1 ? (
          <Button
            title="Next step"
            size="cook"
            onPress={() => setStepIdx((i) => Math.min(totalSteps - 1, i + 1))}
            style={{ flex: 2 }}
          />
        ) : (
          <Button
            title="Finish cooking"
            size="cook"
            onPress={() => router.back()}
            style={{ flex: 2 }}
          />
        )}
      </View>

      {/* Ingredients Sheet */}
      <Modal
        visible={ingSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIngSheetOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIngSheetOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={[TYPOGRAPHY.heading, { color: colors.text }]}>
                Ingredients (Serves {targetServings})
              </Text>
              <Pressable onPress={() => setIngSheetOpen(false)} style={{ padding: SPACING.xs }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {scaledIngredients.map((ing, idx) => {
                const qtyText = formatQuantity(ing.qty, ing.unit);
                return (
                  <View
                    key={idx}
                    style={{
                      paddingVertical: SPACING.sm + 2,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={[TYPOGRAPHY.body, { color: colors.text }]}>
                      {qtyText ? <Text style={{ fontWeight: '700' }}>{qtyText} </Text> : null}
                      {ing.name}
                      {ing.note ? (
                        <Text style={{ color: colors.textSecondary }}>, {ing.note}</Text>
                      ) : null}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  topBtn: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  stepContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  stepCard: {
    padding: SPACING.xl,
  },
  timersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
});
