import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import * as Clipboard from 'expo-clipboard';
import { getDbExecutor } from '@/db/client';
import { setSetting } from '@/db/repositories/settings';
import { fetchAndExtractRecipe } from '@/import/link';
import { Button, Card, Screen, TextField } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function ImportLinkScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPasteFallback, setShowPasteFallback] = useState(false);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setUrl(text.trim());
  };

  const handleImport = async () => {
    setErrorMsg(null);
    setShowPasteFallback(false);

    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      setErrorMsg('Importing needs a connection. Your recipes still work offline.');
      return;
    }

    setLoading(true);
    const res = await fetchAndExtractRecipe(url);
    setLoading(false);

    if (!res.ok) {
      setErrorMsg(res.error.message);
      if (res.error.kind === 'import' && res.error.subtype === 'noRecipeData') {
        setShowPasteFallback(true);
      }
      return;
    }

    const key = `import_draft_${Date.now()}`;
    setSetting(getDbExecutor(), key, JSON.stringify(res.value.draft));
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
        <Text style={[TYPOGRAPHY.heading, { color: colors.text }]}>Import from link</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.body}>
        <Text style={[TYPOGRAPHY.body, { color: colors.textSecondary }]}>
          Paste a recipe URL. Ladleful reads structured recipe data (JSON-LD) and opens a review
          screen before saving anything.
        </Text>

        <TextField
          label="Recipe URL"
          placeholder="https://example.com/jollof-rice"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={url}
          onChangeText={setUrl}
        />

        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <Button
            title="Paste link"
            variant="secondary"
            onPress={handlePaste}
            style={{ flex: 1 }}
          />
          <Button
            title="Import"
            onPress={handleImport}
            loading={loading}
            disabled={!url.trim()}
            style={{ flex: 2 }}
          />
        </View>

        {errorMsg ? (
          <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }}>
            <Text style={[TYPOGRAPHY.body, { color: colors.danger }]}>{errorMsg}</Text>
            {showPasteFallback ? (
              <Button
                title="Try Paste text instead"
                variant="secondary"
                onPress={() => router.replace('/import/text')}
                style={{ marginTop: SPACING.md }}
              />
            ) : null}
          </Card>
        ) : null}
      </View>
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
