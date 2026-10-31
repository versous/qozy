import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  useAudioPlaylist,
  useAudioPlaylistStatus,
  setAudioModeAsync,
  type AudioPlaylist,
} from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const tracks = [
  {
    title: 'Cozy Lofi Beat — Split Memories',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-cozy-lofi-beat-split-memmories-248205.mp3'),
  },
  {
    title: 'Cozy Lofi Beat — Sunset Stars',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-cozy-lofi-beat-sunset-stars-253833.mp3'),
  },
  {
    title: 'Relaxing Lofi Beat — Blue Sky',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-relaxing-lofi-beat-blue-sky-mastered-244362.mp3'),
  },
  {
    title: 'Free Lofi Beat — Radiation',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-free-lofi-beat-quotradiationquot-147267.mp3'),
  },
  {
    title: 'Relaxing Ambient Music 01',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-relaxing-ambient-music-01-293925.mp3'),
  },
  {
    title: 'Melodic Rock Guitar Backing Track in E minor',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-melodic-rock-guitar-backing-track-in-em-430188.mp3'),
  },
] as const;

interface MusicContextValue {
  player: AudioPlaylist;
  currentTrack: (typeof tracks)[number];
  isPlaying: boolean;
  nextTrack: () => void;
  togglePlayback: () => void;
}

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicProvider({
  children,
  enabled,
}: React.PropsWithChildren<{ enabled: boolean }>) {
  const player = useAudioPlaylist({
    sources: tracks.map((track) => track.source),
    loop: 'all',
  });
  const status = useAudioPlaylistStatus(player);
  const [toastVisible, setToastVisible] = useState(false);
  const currentIndex = status.currentIndex;

  useEffect(() => {
    // expo-audio exposes volume as a mutable player property rather than a setter.
    // eslint-disable-next-line react-hooks/immutability
    player.volume = 0.2;
  }, [player]);

  useEffect(() => {
    const subscription = player.addListener('trackChanged', () => {
      setToastVisible(true);
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (!enabled) {
      player.pause();
      return;
    }

    let active = true;
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).then(() => {
      if (active) {
        player.play();
        setToastVisible(true);
      }
    }).catch((error: unknown) => {
      console.warn('Impossible de démarrer la musique Qozy.', error);
    });

    return () => {
      active = false;
      player.pause();
    };
  }, [enabled, player]);

  useEffect(() => {
    if (!toastVisible) return;
    const timeout = setTimeout(() => setToastVisible(false), 7000);
    return () => clearTimeout(timeout);
  }, [toastVisible, currentIndex]);

  const value = useMemo<MusicContextValue>(() => ({
    player,
    currentTrack: tracks[currentIndex] ?? tracks[0],
    isPlaying: status.playing,
    nextTrack: () => player.next(),
    togglePlayback: () => status.playing ? player.pause() : player.play(),
  }), [currentIndex, player, status.playing]);

  return (
    <MusicContext.Provider value={value}>
      {children}
      {enabled ? <TrackToast value={value} visible={toastVisible} /> : null}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic doit être utilisé dans MusicProvider.');
  return context;
}

function TrackToast({ value, visible }: { value: MusicContextValue; visible: boolean }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createToastStyles(colors);
  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.toastLayer, { top: insets.top + spacing.sm }]}>
      <View accessibilityLiveRegion="polite" style={styles.toast}>
        <Text style={styles.musicIcon}>♫</Text>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{value.currentTrack.title}</Text>
          <Text numberOfLines={1} style={styles.artist}>{value.currentTrack.artist}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value.isPlaying ? 'Mettre la musique en pause' : 'Reprendre la musique'}
          onPress={value.togglePlayback}
          hitSlop={8}
          style={styles.control}>
          <Text style={styles.controlText}>{value.isPlaying ? 'Ⅱ' : '▷'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Passer à la musique suivante"
          onPress={value.nextTrack}
          hitSlop={8}
          style={styles.control}>
          <Text style={styles.controlText}>»</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createToastStyles = (palette: AppColors) => StyleSheet.create({
  toastLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
  },
  toast: {
    maxWidth: '90%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.medium,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 8,
  },
  musicIcon: { color: palette.sage, fontSize: 18 },
  copy: { flex: 1 },
  title: { color: palette.textPrimary, fontSize: 10, fontWeight: '700' },
  artist: { color: palette.textSecondary, fontSize: 9, marginTop: 2 },
  control: { minWidth: 24, minHeight: 30, alignItems: 'center', justifyContent: 'center' },
  controlText: { color: palette.sage, fontSize: 16, fontWeight: '700' },
});
