import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ensureDatabaseInitialized, getDbExecutor } from '@/db/client';
import { hasCompletedOnboarding } from '@/db/repositories/settings';
import { useTimerStore } from '@/stores/timerStore';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { ThemeProvider, useTheme } from '@/ui/ThemeContext';
import { ToastBanner } from '@/ui/ToastBanner';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

function RootNavigator() {
  const { isDark, colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const loadTimers = useTimerStore((s) => s.loadTimers);

  useEffect(() => {
    ensureDatabaseInitialized();
    loadTimers();
    const done = hasCompletedOnboarding(getDbExecutor());
    const inOnboarding = segments[0] === 'onboarding';
    if (!done && !inOnboarding) {
      router.replace('/onboarding');
    }
  }, [segments, router, loadTimers]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const recipeId = response.notification.request.content.data?.recipeId;
      if (typeof recipeId === 'string' && recipeId.length > 0) {
        router.push({ pathname: '/recipe/cook', params: { id: recipeId } });
      }
    });
    return () => sub.remove();
  }, [router]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="recipe/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe/cook" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="shopping/[id]" />
        <Stack.Screen name="import/link" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import/text" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import/backup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings/pantry" />
        <Stack.Screen name="settings/account" />
      </Stack>
      <ToastBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
