import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getDbExecutor } from '@/db/client';
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/db/repositories/settings';
import { DARK_COLORS, LIGHT_COLORS, type ThemeColors } from './tokens';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT_COLORS,
  isDark: false,
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPrefState] = useState<ThemePreference>(() => {
    try {
      return getThemePreference(getDbExecutor());
    } catch {
      return 'system';
    }
  });

  const setPreference = (pref: ThemePreference) => {
    setPrefState(pref);
    try {
      setThemePreference(getDbExecutor(), pref);
    } catch {
      // Ignore if DB not ready
    }
  };

  const isDark =
    preference === 'dark' || (preference === 'system' && systemScheme === 'dark');

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? DARK_COLORS : LIGHT_COLORS,
      isDark,
      preference,
      setPreference,
    }),
    [isDark, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
