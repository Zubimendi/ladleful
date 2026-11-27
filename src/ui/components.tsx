import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from './tokens';
import { useTheme } from './ThemeContext';

export function Screen({
  children,
  style,
  edges = ['top'],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: SPACING.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'default' | 'cook';
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  variant = 'primary',
  size = 'default',
  loading = false,
  icon,
  disabled,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const minHeight = size === 'cook' ? TOUCH_TARGET.cook : TOUCH_TARGET.min;

  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surface
          : 'transparent';

  const textColor =
    variant === 'primary'
      ? colors.textOnPrimary
      : variant === 'danger'
        ? '#FFFFFF'
        : variant === 'secondary'
          ? colors.text
          : colors.primary;

  const borderColor = variant === 'secondary' ? colors.border : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: loading }}
      disabled={disabled || loading}
      onPress={(e) => {
        void Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.buttonBase,
        {
          minHeight,
          backgroundColor: pressed && variant === 'primary' ? colors.primaryPressed : bg,
          borderColor,
          borderWidth: variant === 'secondary' ? 1 : 0,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <View style={{ marginRight: SPACING.sm }}>{icon}</View> : null}
          <Text style={[TYPOGRAPHY.label, { color: textColor, fontSize: size === 'cook' ? 18 : 15 }]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          minHeight: 38,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.xs + 2,
          borderRadius: RADIUS.pill,
          backgroundColor: active ? colors.primary : colors.chipBg,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? <View style={{ marginRight: SPACING.xs + 2 }}>{icon}</View> : null}
      <Text
        style={[
          TYPOGRAPHY.label,
          {
            fontSize: 13,
            color: active ? colors.textOnPrimary : colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface TextFieldProps extends TextInputProps {
  label?: string;
  helper?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function TextField({
  label,
  helper,
  error,
  containerStyle,
  inputStyle,
  multiline,
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[TYPOGRAPHY.label, { color: colors.text, marginBottom: SPACING.xs + 2 }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          TYPOGRAPHY.body,
          {
            backgroundColor: colors.surface,
            color: colors.text,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: RADIUS.md,
            paddingHorizontal: SPACING.md,
            paddingVertical: multiline ? SPACING.md : SPACING.sm + 2,
            minHeight: multiline ? 110 : TOUCH_TARGET.min,
          },
          inputStyle,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[TYPOGRAPHY.caption, { color: colors.danger, marginTop: SPACING.xs }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginTop: SPACING.xs }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyContainer}>
      {icon ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: SPACING.lg,
          }}
        >
          {icon}
        </View>
      ) : null}
      <Text style={[TYPOGRAPHY.heading, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {subtitle ? (
        <Text
          style={[
            TYPOGRAPHY.body,
            { color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.sm, maxWidth: 300 },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
      {children ? <View style={{ marginTop: SPACING.xl, width: '100%', gap: SPACING.sm }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
});
