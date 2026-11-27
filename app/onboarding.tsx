import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { buildStarterRecipes } from '@/data/starterRecipes';
import { ensureDatabaseInitialized, getDbExecutor, notifyDbChanged } from '@/db/client';
import { importRecipesBatch } from '@/db/repositories/recipes';
import { markOnboardingCompleted } from '@/db/repositories/settings';
import { now } from '@/lib/clock';
import { Button, Card, Screen } from '@/ui/components';
import { useTheme } from '@/ui/ThemeContext';
import { SPACING, TYPOGRAPHY } from '@/ui/tokens';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [includeSamples, setIncludeSamples] = useState(true);
  const [starting, setStarting] = useState(false);

  const handleStart = () => {
    setStarting(true);
    ensureDatabaseInitialized();
    const db = getDbExecutor();
    if (includeSamples) {
      importRecipesBatch(db, buildStarterRecipes(now()), notifyDbChanged);
    }
    markOnboardingCompleted(db);
    router.replace('/(tabs)');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View
            style={[
              styles.logoBadge,
              { backgroundColor: colors.primarySoft, borderColor: colors.border },
            ]}
          >
            <Ionicons name="restaurant" size={36} color={colors.primary} />
          </View>

          <Text style={[TYPOGRAPHY.title, { color: colors.text, marginTop: SPACING.xl }]}>
            Your kitchen recipe box, always offline.
          </Text>
          <Text
            style={[
              TYPOGRAPHY.body,
              { color: colors.textSecondary, marginTop: SPACING.md, lineHeight: 24 },
            ]}
          >
            Keep recipes on your phone. Search in milliseconds, scale servings cleanly, cook with a
            screen that stays awake, and merge ingredients into one shopping list.
          </Text>

          <Card style={{ marginTop: SPACING.xl }}>
            <View style={styles.row}>
              <View style={{ flex: 1, paddingRight: SPACING.md }}>
                <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>
                  Add 3 starter recipes
                </Text>
                <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  Tomato stew base, Jollof rice, and Boiled yam & egg sauce.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Add 3 starter recipes"
                value={includeSamples}
                onValueChange={setIncludeSamples}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>

          <View style={styles.pillRow}>
            <View style={styles.featureItem}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.primary} />
              <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginLeft: 6 }]}>
                No account required
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginLeft: 6 }]}>
                Your data stays yours
              </Text>
            </View>
          </View>
        </View>

        <Button title="Open my recipe box" onPress={handleStart} loading={starting} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
