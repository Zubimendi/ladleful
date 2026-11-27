import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { getDbExecutor, notifyDbChanged } from '@/db/client';
import { getExistingRecipeIds, importRecipesBatch } from '@/db/repositories/recipes';
import {
  resolveConflictRecipes,
  validateAndPlanBackup,
  type BackupImportPlan,
  type ConflictMode,
} from '@/import/backup';
import { useUiStore } from '@/stores/uiStore';
import { Button, Card, Chip, Screen } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function ImportBackupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const showToast = useUiStore((s) => s.showToast);

  const [plan, setPlan] = useState<BackupImportPlan | null>(null);
  const [conflictMode, setConflictMode] = useState<ConflictMode>('skip');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handlePickFile = async () => {
    setErrorMsg(null);
    setPlan(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;

    try {
      const file = new FileSystem.File(picked.assets[0].uri);
      const rawJson = await file.text();
      const existingIds = getExistingRecipeIds(getDbExecutor());
      const res = validateAndPlanBackup(rawJson, existingIds);
      if (!res.ok) {
        setErrorMsg(res.error.message);
        return;
      }
      setPlan(res.value);
    } catch {
      setErrorMsg("Could not read that file. Make sure it's a Ladleful .json backup.");
    }
  };

  const handleApplyImport = () => {
    if (!plan) return;
    setImporting(true);
    const db = getDbExecutor();
    const existingIds = getExistingRecipeIds(db);
    const toImport = resolveConflictRecipes(plan.recipes, existingIds, conflictMode);
    const res = importRecipesBatch(db, toImport, notifyDbChanged);
    setImporting(false);

    if (!res.ok) {
      setErrorMsg(res.error.message);
      return;
    }

    showToast({ message: `Imported ${res.value} recipes.` });
    router.replace('/(tabs)');
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
        <Text style={[TYPOGRAPHY.heading, { color: colors.text }]}>Import backup</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[TYPOGRAPHY.body, { color: colors.textSecondary }]}>
          Select a Ladleful JSON backup file. Files are validated before anything is written.
        </Text>

        <Button title="Choose backup file (.json)" onPress={handlePickFile} />

        {errorMsg ? (
          <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.danger }}>
            <Text style={[TYPOGRAPHY.body, { color: colors.danger }]}>{errorMsg}</Text>
          </Card>
        ) : null}

        {plan ? (
          <Card style={{ gap: SPACING.md }}>
            <Text style={[TYPOGRAPHY.heading, { color: colors.text }]}>Backup summary</Text>
            <Text style={[TYPOGRAPHY.body, { color: colors.text }]}>
              • {plan.newRecipeCount} new recipes{'\n'}
              • {plan.existingRecipeCount} already in your library{'\n'}
              • {plan.invalidRecipeCount} skipped (invalid)
            </Text>

            {plan.existingRecipeCount > 0 ? (
              <View style={{ gap: SPACING.sm }}>
                <Text style={[TYPOGRAPHY.label, { color: colors.text }]}>
                  For recipes already here:
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
                  <Chip
                    label="Skip existing"
                    active={conflictMode === 'skip'}
                    onPress={() => setConflictMode('skip')}
                  />
                  <Chip
                    label="Replace existing"
                    active={conflictMode === 'replace'}
                    onPress={() => setConflictMode('replace')}
                  />
                  <Chip
                    label="Keep both"
                    active={conflictMode === 'keepBoth'}
                    onPress={() => setConflictMode('keepBoth')}
                  />
                </View>
              </View>
            ) : null}

            <Button
              title="Apply import"
              onPress={handleApplyImport}
              loading={importing}
              style={{ marginTop: SPACING.sm }}
            />
          </Card>
        ) : null}
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
