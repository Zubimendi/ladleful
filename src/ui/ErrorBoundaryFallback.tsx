import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, EmptyState, Screen } from './components';
import { useTheme } from './ThemeContext';

export function ErrorBoundaryFallback({
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <EmptyState
          icon={<Ionicons name="alert-circle-outline" size={32} color={colors.danger} />}
          title="Something went wrong"
          subtitle="Your recipes are safely stored on this device. Tap below to reload this screen."
        >
          <Button title="Reload screen" onPress={retry} />
        </EmptyState>
      </View>
    </Screen>
  );
}
