import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDbExecutor, notifyDbChanged } from '@/db/client';
import { getPantryStaples, setPantryStaples } from '@/db/repositories/settings';
import { Button, Chip, Screen, TextField } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function PantryStaplesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const db = getDbExecutor();

  const [staples, setStaples] = useState<string[]>(() => getPantryStaples(db));
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const val = input.trim().toLowerCase();
    if (!val || staples.includes(val)) {
      setInput('');
      return;
    }
    const next = [...staples, val];
    setStaples(next);
    setPantryStaples(db, next);
    notifyDbChanged();
    setInput('');
  };

  const handleRemove = (item: string) => {
    const next = staples.filter((s) => s !== item);
    setStaples(next);
    setPantryStaples(db, next);
    notifyDbChanged();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[TYPOGRAPHY.heading, { color: colors.text }]}>Pantry staples</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[TYPOGRAPHY.body, { color: colors.textSecondary }]}>
          Items listed here are automatically skipped when building a shopping list from recipes.
        </Text>

        <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-end' }}>
          <TextField
            label="Add staple"
            placeholder="e.g. olive oil"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleAdd}
            containerStyle={{ flex: 1 }}
          />
          <Button title="Add" onPress={handleAdd} disabled={!input.trim()} />
        </View>

        <View style={styles.chipsWrap}>
          {staples.map((s) => (
            <Chip
              key={s}
              label={`${s} ×`}
              onPress={() => handleRemove(s)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    justifyContent: 'center',
  },
  body: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
});
