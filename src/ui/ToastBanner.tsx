import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useUiStore } from '@/stores/uiStore';
import { RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from './tokens';
import { useTheme } from './ThemeContext';

export function ToastBanner() {
  const { colors } = useTheme();
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      dismissToast();
    }, 4500);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <View
      pointerEvents="box-none"
      style={styles.wrapper}
    >
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            backgroundColor: colors.text,
          },
        ]}
      >
        <Text style={[TYPOGRAPHY.label, { color: colors.surface, flex: 1 }]} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.actionLabel && toast.onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
            onPress={() => {
              toast.onAction?.();
              dismissToast();
            }}
            style={styles.actionBtn}
          >
            <Text style={[TYPOGRAPHY.label, { color: colors.accent }]}>{toast.actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: SPACING.xxl + 56,
    zIndex: 100,
  },
  toast: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: TOUCH_TARGET.min,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  actionBtn: {
    marginLeft: SPACING.md,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
});
