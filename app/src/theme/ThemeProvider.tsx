import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { ReduceMotion, ReducedMotionConfig } from 'react-native-reanimated';

import { darkColors, lightColors, type AppColors } from '@/theme/colors';

export type ThemeMode = 'light' | 'dark' | 'system';
export type TextSize = 'standard' | 'large' | 'largest';

interface ThemeContextValue {
  colors: AppColors;
  mode: ThemeMode;
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  setMode: (mode: ThemeMode) => void;
  setTextSize: (size: TextSize) => void;
  setHighContrast: (enabled: boolean) => void;
  setReduceMotion: (enabled: boolean) => void;
}

const STORAGE_KEY = 'qozy-theme-mode';
const ACCESSIBILITY_STORAGE_KEY = 'qozy-accessibility-preferences';

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  mode: 'system',
  textSize: 'standard',
  highContrast: false,
  reduceMotion: false,
  setMode: () => {},
  setTextSize: () => {},
  setHighContrast: () => {},
  setReduceMotion: () => {},
});

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [textSize, setTextSizeState] = useState<TextSize>('standard');
  const [highContrast, setHighContrastState] = useState(false);
  const [reduceMotion, setReduceMotionState] = useState(false);
  const resolvedMode = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((savedMode) => {
      if (active && (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system')) {
        setModeState(savedMode);
      }
    }).catch((error: unknown) => {
      console.warn('Impossible de charger le thème enregistré.', error);
    });
    void AsyncStorage.getItem(ACCESSIBILITY_STORAGE_KEY).then((value) => {
      if (!active || !value) return;
      const saved = JSON.parse(value) as Partial<Pick<ThemeContextValue, 'textSize' | 'highContrast' | 'reduceMotion'>>;
      if (saved.textSize === 'standard' || saved.textSize === 'large' || saved.textSize === 'largest') {
        setTextSizeState(saved.textSize);
      }
      if (typeof saved.highContrast === 'boolean') setHighContrastState(saved.highContrast);
      if (typeof saved.reduceMotion === 'boolean') setReduceMotionState(saved.reduceMotion);
    }).catch((error: unknown) => {
      console.warn('Impossible de charger les préférences d’accessibilité.', error);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(STORAGE_KEY, nextMode).catch((error: unknown) => {
      console.warn('Impossible d’enregistrer le thème choisi.', error);
    });
  }, []);

  const saveAccessibilityPreferences = useCallback((next: {
    textSize?: TextSize;
    highContrast?: boolean;
    reduceMotion?: boolean;
  }) => {
    const updated = {
      textSize: next.textSize ?? textSize,
      highContrast: next.highContrast ?? highContrast,
      reduceMotion: next.reduceMotion ?? reduceMotion,
    };
    void AsyncStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(updated)).catch((error: unknown) => {
      console.warn('Impossible d’enregistrer les préférences d’accessibilité.', error);
    });
  }, [highContrast, reduceMotion, textSize]);

  const setTextSize = useCallback((size: TextSize) => {
    setTextSizeState(size);
    saveAccessibilityPreferences({ textSize: size });
  }, [saveAccessibilityPreferences]);
  const setHighContrast = useCallback((enabled: boolean) => {
    setHighContrastState(enabled);
    saveAccessibilityPreferences({ highContrast: enabled });
  }, [saveAccessibilityPreferences]);
  const setReduceMotion = useCallback((enabled: boolean) => {
    setReduceMotionState(enabled);
    saveAccessibilityPreferences({ reduceMotion: enabled });
  }, [saveAccessibilityPreferences]);

  const colors = useMemo(() => {
    const palette = resolvedMode === 'dark' ? darkColors : lightColors;
    if (!highContrast) return palette;
    return {
      ...palette,
      textPrimary: resolvedMode === 'dark' ? '#FFFFFF' : '#20251D',
      textSecondary: resolvedMode === 'dark' ? '#E1E4DC' : '#555B50',
      textLight: resolvedMode === 'dark' ? '#C1C5BA' : '#686E62',
      sage: resolvedMode === 'dark' ? '#D0E3C6' : '#496344',
      primary: resolvedMode === 'dark' ? '#D0E3C6' : '#496344',
      border: resolvedMode === 'dark' ? '#596151' : '#9A9B8C',
    };
  }, [resolvedMode, highContrast]);

  const value = useMemo(() => ({
    colors,
    mode,
    textSize,
    highContrast,
    reduceMotion,
    setMode,
    setTextSize,
    setHighContrast,
    setReduceMotion,
  }), [colors, mode, textSize, highContrast, reduceMotion, setMode, setTextSize, setHighContrast, setReduceMotion]);

  return (
    <ThemeContext.Provider value={value}>
      {reduceMotion ? <ReducedMotionConfig mode={ReduceMotion.Always} /> : null}
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
