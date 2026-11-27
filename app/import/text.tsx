import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getDbExecutor } from '@/db/client';
import { setSetting } from '@/db/repositories/settings';
import { splitPastedText } from '@/import/text';
import { Button, Screen, TextField } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function ImportTextScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');

  const handlePaste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip) setText(clip);
  };

  const handleContinue = () => {
    const draft = splitPastedText(text);
    const key = `paste_draft_${Date.now()}`;
    setSetting(getDbExecutor(), key, JSON.stringify(draft));
    router.replace(`/recipe/edit?draftKey=${key}`);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[TYPOGRAPHY.heading, { color: colors.text }]}>Paste recipe text</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <TextField
          label="Recipe text"
          placeholder={'Jollof Rice\n\nIngredients:\n3 cups rice\n2 tbsp tomato paste\n\nSteps:\n1. Fry the paste.\n2. Add rice and stock.'}
          multiline
          value={text}
          onChangeText={setText}
          inputStyle={{ minHeight: 240 }}
          helper="First line becomes title. 'Ingredients:' and 'Steps:' headings split sections."
        />

        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <Button
            title="Paste clipboard"
            variant="secondary"
            onPress={handlePaste}
            style={{ flex: 1 }}
          />
          <Button
            title="Review & edit"
            onPress={handleContinue}
            disabled={!text.trim()}
            style={{ flex: 2 }}
          />
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
  closeBtn: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    justifyContent: 'center',
  },
  body: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
});
