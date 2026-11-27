import React, { useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDbExecutor, notifyDbChanged } from '@/db/client';
import { getAllRecipes } from '@/db/repositories/recipes';
import { getPantryStaples } from '@/db/repositories/settings';
import { getShoppingItems, getShoppingLists } from '@/db/repositories/shopping';
import { rebuildSearchIndex } from '@/db/search';
import { serializeBackup } from '@/export/backup';
import { generateDemoLibrary, useDbVersion } from '@/features/hooks';
import { now } from '@/lib/clock';
import { useUiStore } from '@/stores/uiStore';
import type { ShoppingItem } from '@/types/shopping';
import { Card, Chip, Screen } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function SettingsScreen() {
  const { colors, preference, setPreference } = useTheme();
  const router = useRouter();
  const dbVersion = useDbVersion();
  const showToast = useUiStore((s) => s.showToast);

  const db = getDbExecutor();
  const recipeCount = useMemo(() => getAllRecipes(db).length, [dbVersion, db]);
  const staplesCount = useMemo(() => getPantryStaples(db).length, [dbVersion, db]);

  const handleExportBackup = async () => {
    const recipes = getAllRecipes(db);
    const lists = getShoppingLists(db, true);
    const itemsMap = new Map<string, ShoppingItem[]>();
    for (const l of lists) {
      itemsMap.set(l.id, getShoppingItems(db, l.id));
    }
    const json = serializeBackup(recipes, lists, itemsMap, now());
    const file = new FileSystem.File(FileSystem.Paths.cache, `ladleful-backup-${now()}.json`);
    file.write(json);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Ladleful backup',
      });
    } else {
      await Share.share({ message: json, title: 'Ladleful backup' });
    }
    showToast({ message: `Backup ready: ${recipes.length} recipes and ${lists.length} lists.` });
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.title, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Theme */}
        <Card style={{ gap: SPACING.md }}>
          <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>Appearance</Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            <Chip
              label="System"
              active={preference === 'system'}
              onPress={() => setPreference('system')}
            />
            <Chip
              label="Light"
              active={preference === 'light'}
              onPress={() => setPreference('light')}
            />
            <Chip
              label="Dark"
              active={preference === 'dark'}
              onPress={() => setPreference('dark')}
            />
          </View>
        </Card>

        {/* Kitchen */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            icon="nutrition-outline"
            title="Pantry staples"
            subtitle={`${staplesCount} items skipped in shopping lists`}
            onPress={() => router.push('/settings/pantry')}
          />
          <SettingsRow
            icon="cloud-outline"
            title="Account & sync (optional)"
            subtitle="Your recipes stay on this phone unless you sign in"
            onPress={() => router.push('/settings/account')}
            last
          />
        </Card>

        {/* Backup & Portability */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            icon="download-outline"
            title="Export backup (.json)"
            subtitle={`${recipeCount} recipes stored locally`}
            onPress={handleExportBackup}
          />
          <SettingsRow
            icon="push-outline"
            title="Import backup (.json)"
            subtitle="Restore or merge recipes from a backup file"
            onPress={() => router.push('/import/backup')}
            last
          />
        </Card>

        {/* Maintenance & Dev */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <SettingsRow
            icon="refresh-outline"
            title="Rebuild search index"
            subtitle="Re-index all recipes into FTS5"
            onPress={() => {
              rebuildSearchIndex(db);
              notifyDbChanged();
              showToast({ message: 'Search index rebuilt.' });
            }}
          />
          {__DEV__ ? (
            <SettingsRow
              icon="flash-outline"
              title="Load 1,000 demo recipes (Dev)"
              subtitle="Test instant FTS5 search & FlashList scrolling"
              onPress={() => {
                const count = generateDemoLibrary(1000);
                showToast({ message: `Generated ${count} demo recipes.` });
              }}
              last
            />
          ) : null}
        </Card>

        <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.md }]}>
          Ladleful · Offline-first recipe box · Quantities shown as written
        </Text>
      </ScrollView>
    </Screen>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { backgroundColor: colors.chipBg },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>{title}</Text>
        <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  body: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: 60,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    minHeight: TOUCH_TARGET.min,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
});
