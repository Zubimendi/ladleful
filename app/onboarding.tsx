import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { buildStarterRecipes } from '@/data/starterRecipes';
import { ensureDatabaseInitialized, getDbExecutor, notifyDbChanged } from '@/db/client';
import { importRecipesBatch } from '@/db/repositories/recipes';
import { markOnboardingCompleted } from '@/db/repositories/settings';
import { now } from '@/lib/clock';
import { Button, Card, Screen } from '@/ui/components';
import { useTheme } from '@/ui/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/ui/tokens';

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
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBrandRow}>
          <View style={styles.brandLockup}>
            <View
              style={[
                styles.logoBadge,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoImage}
                contentFit="contain"
                accessibilityLabel="Ladleful logo"
              />
            </View>
            <Text style={[TYPOGRAPHY.subheading, { color: colors.text, marginLeft: SPACING.sm }]}>
              Ladleful
            </Text>
          </View>
          <View style={[styles.offlinePill, { backgroundColor: colors.primarySoft }]}>
            <Text style={[TYPOGRAPHY.caption, { color: colors.primary, fontWeight: '600' }]}>
              Offline-first
            </Text>
          </View>
        </View>

        <View style={[styles.heroWrap, { backgroundColor: '#F6F7F3', borderColor: colors.border }]}>
          <Image
            source={require('../assets/landing-hero.png')}
            style={styles.heroImage}
            contentFit="contain"
            accessibilityLabel="Illustrated wooden recipe box with recipe cards and ladle"
          />
        </View>

        <View style={styles.copySection}>
          <Text style={[TYPOGRAPHY.title, { color: colors.text }]}>
            Your kitchen recipe box, always offline.
          </Text>
          <Text
            style={[
              TYPOGRAPHY.body,
              { color: colors.textSecondary, marginTop: SPACING.sm, lineHeight: 23 },
            ]}
          >
            Keep recipes on your phone. Search in milliseconds, scale servings cleanly, cook with a
            screen that stays awake, and merge ingredients into one shopping list.
          </Text>

          <Card style={{ marginTop: SPACING.lg }}>
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

        <View style={{ marginTop: SPACING.lg }}>
          <Button title="Open my recipe box" onPress={handleStart} loading={starting} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  topBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  offlinePill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  heroWrap: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    height: 210,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  copySection: {
    marginTop: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
