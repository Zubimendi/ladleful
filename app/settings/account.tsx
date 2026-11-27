import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmail, signOut, signUpWithEmail } from '@/api/auth';
import { isSyncConfigured, loadAuthSession } from '@/api/pb';
import { getDbExecutor, notifyDbChanged } from '@/db/client';
import { getParkedOutboxCount, getPendingOutboxCount } from '@/db/repositories/outbox';
import { deleteSetting, getSetting, setSetting } from '@/db/repositories/settings';
import { useUiStore } from '@/stores/uiStore';
import { drainOutbox, pullRecipes } from '@/sync/engine';
import { createPocketBaseTransport } from '@/sync/pbTransport';
import { Button, Card, Screen, TextField } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function AccountSyncScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const showToast = useUiStore((s) => s.showToast);
  const db = getDbExecutor();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedInUser, setSignedInUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    void loadAuthSession().then((sess) => {
      if (sess) setSignedInUser(sess.user);
    });
  }, []);

  const configured = isSyncConfigured();
  const pending = getPendingOutboxCount(db);
  const parked = getParkedOutboxCount(db);

  const handleAuth = async (mode: 'signin' | 'signup') => {
    setErrorMsg(null);
    setLoading(true);
    const res =
      mode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);
    setLoading(false);

    if (!res.ok) {
      setErrorMsg(res.error.message);
      return;
    }

    const prevOwner = getSetting(db, 'sync_owner_id');
    if (prevOwner && prevOwner !== res.value.id) {
      setErrorMsg('This phone has data from another account. Sign out to switch safely.');
      return;
    }

    setSetting(db, 'sync_owner_id', res.value.id);
    setSignedInUser(res.value);
    showToast({ message: 'Signed in. Optional sync enabled.' });
  };

  const handleSyncNow = async () => {
    if (!signedInUser) return;
    const transport = createPocketBaseTransport();
    if (!transport) return;
    setSyncing(true);
    await drainOutbox(db, signedInUser.id, transport);
    await pullRecipes(db, transport, notifyDbChanged);
    setSyncing(false);
    showToast({ message: 'Sync complete.' });
  };

  const handleSignOut = async () => {
    await signOut();
    deleteSetting(db, 'sync_owner_id');
    setSignedInUser(null);
    showToast({ message: 'Signed out. Local recipes kept.' });
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
        <Text style={[TYPOGRAPHY.heading, { color: colors.text }]}>Account & Sync</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[TYPOGRAPHY.body, { color: colors.textSecondary }]}>
          Optional. Your recipes stay on this phone unless you sign in.
        </Text>

        {!configured ? (
          <Card>
            <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>Local-only mode</Text>
            <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              Set EXPO_PUBLIC_API_URL in .env to connect a PocketBase instance for multi-device
              sync.
            </Text>
          </Card>
        ) : signedInUser ? (
          <Card style={{ gap: SPACING.md }}>
            <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>
              Signed in as {signedInUser.email}
            </Text>
            <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>
              Pending outbox: {pending} · Parked issues: {parked}
            </Text>
            <Button title="Sync now" onPress={handleSyncNow} loading={syncing} />
            <Button title="Sign out" variant="secondary" onPress={handleSignOut} />
          </Card>
        ) : (
          <Card style={{ gap: SPACING.md }}>
            <TextField
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {errorMsg ? (
              <Text style={[TYPOGRAPHY.caption, { color: colors.danger }]}>{errorMsg}</Text>
            ) : null}
            <Button title="Sign in" onPress={() => handleAuth('signin')} loading={loading} />
            <Button
              title="Create account"
              variant="secondary"
              onPress={() => handleAuth('signup')}
              disabled={loading}
            />
          </Card>
        )}
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
});
