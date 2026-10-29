import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

import { darkColors, lightColors, type AppColors } from '@/theme/colors';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  colors: AppColors;
  mode: ThemeMode;
  toggleMode: () => void;
}

const STORAGE_KEY = 'qozy-theme-mode';

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  mode: 'light',
  toggleMode: () => {},
});

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((savedMode) => {
      if (active && (savedMode === 'light' || savedMode === 'dark')) {
        setMode(savedMode);
      }
    }).catch((error: unknown) => {
      console.warn('Impossible de charger le thème enregistré.', error);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
    void AsyncStorage.setItem(STORAGE_KEY, nextMode).catch((error: unknown) => {
      console.warn('Impossible d’enregistrer le thème choisi.', error);
    });
  }, [mode]);

  const value = useMemo(
    () => ({ colors: mode === 'dark' ? darkColors : lightColors, mode, toggleMode }),
    [mode, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
