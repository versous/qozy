import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  useAudioPlaylist,
  useAudioPlaylistStatus,
  setAudioModeAsync,
} from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePremium } from '@/services/PremiumProvider';
import { useDeviceStatus } from '@/components/SessionDeviceStatus';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  source: number;
  premium?: boolean;
}

const lofiTracks: MusicTrack[] = [
  {
    id: 'lofi-split-memories',
    title: 'Cozy Lofi Beat — Split Memories',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-cozy-lofi-beat-split-memmories-248205.mp3'),
  },
  {
    id: 'lofi-sunset-stars',
    title: 'Cozy Lofi Beat — Sunset Stars',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-cozy-lofi-beat-sunset-stars-253833.mp3'),
  },
  {
    id: 'lofi-blue-sky',
    title: 'Relaxing Lofi Beat — Blue Sky',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-relaxing-lofi-beat-blue-sky-mastered-244362.mp3'),
    premium: true,
  },
  {
    id: 'lofi-street-beats',
    title: 'Cozy Lofi Street Beats',
    artist: 'Joris Vermeer',
    source: require('@/assets/audio/jorisvermeer-cozy-lofi-street-beats-523195.mp3'),
    premium: true,
  },
  {
    id: 'lofi-radiation',
    title: 'Free Lofi Beat — Radiation',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-free-lofi-beat-quotradiationquot-147267.mp3'),
    premium: true,
  },
  {
    id: 'lofi-cozy-corner',
    title: 'Cozy Corner Lofi Chill',
    artist: 'Joris Vermeer',
    source: require('@/assets/audio/jorisvermeer-cozy-corner-lofi-chill-521862.mp3'),
    premium: true,
  },
  {
    id: 'lofi-midnight-dreams',
    title: 'Midnight Dreams',
    artist: 'Lofivision',
    source: require('@/assets/audio/lofivision-midnight-dreams-241994.mp3'),
    premium: true,
  },
  {
    id: 'lofi-cozy-day',
    title: 'A Cozy Day',
    artist: 'Lofi Hour',
    source: require('@/assets/audio/lofi_hour-a-cozy-day-114852.mp3'),
    premium: true,
  },
  {
    id: 'lofi-cozy-night',
    title: 'Cozy Night China',
    artist: 'YU6B',
    source: require('@/assets/audio/yu6b-cozy-night-china-v1-613373.mp3'),
    premium: true,
  },
];

const meditationTracks: MusicTrack[] = [
  {
    id: 'meditation-soft',
    title: 'Méditation douce',
    artist: 'AtlasAudio',
    source: require('@/assets/audio/atlasaudio-meditation-621581.mp3'),
  },
  {
    id: 'meditation-ambience',
    title: 'Ambiance méditation',
    artist: 'Qozy',
    source: require('@/assets/audio/meditation-ambience.wav'),
  },
  {
    id: 'meditation-relaxing-ambient',
    title: 'Relaxing Ambient Music 01',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-relaxing-ambient-music-01-293925.mp3'),
    premium: true,
  },
  {
    id: 'meditation-bell',
    title: 'Cloche de méditation',
    artist: 'AtlasAudio',
    source: require('@/assets/audio/atlasaudio-meditation-bell-613490.mp3'),
    premium: true,
  },
  {
    id: 'meditation-autumn-sky',
    title: 'Autumn Sky Meditation',
    artist: 'NaturesEye',
    source: require('@/assets/audio/natureseye-autumn-sky-meditation-7618.mp3'),
    premium: true,
  },
  {
    id: 'meditation-cozy-forest',
    title: 'Cozy Forest',
    artist: 'Black Box',
    source: require('@/assets/audio/blackbox-black-box-cozy-forest-122347.mp3'),
    premium: true,
  },
  {
    id: 'meditation-rain',
    title: 'Cozy Bedroom Rain',
    artist: 'Celeron Beats',
    source: require('@/assets/audio/celeronbeats-cozy-bedroom-rain-amp-ambient-sounds-574987.mp3'),
    premium: true,
  },
];

const sportTracks: MusicTrack[] = [
  {
    id: 'sport-guitar-backing',
    title: 'Melodic Rock Guitar',
    artist: 'IDoberG',
    source: require('@/assets/audio/idoberg-melodic-rock-guitar-backing-track-in-em-430188.mp3'),
  },
];

interface MusicContextValue {
  currentTrack: MusicTrack;
  tracks: MusicTrack[];
  catalog: MusicTrack[];
  selectedTrackId: string;
  isPlaying: boolean;
  isLoaded: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  isPremium: boolean;
  premiumTrackCount: number;
  selectTrack: (trackId: string) => void;
  play: () => void;
  pause: () => void;
  nextTrack: () => void;
  togglePlayback: () => void;
}

interface MusicContextValues {
  lofi: MusicContextValue;
  meditation: MusicContextValue;
  sport: MusicContextValue;
  requestMeditation: () => void;
  requestSport: () => void;
}

type MusicCategory = 'lofi' | 'meditation' | 'sport';

const MusicContext = createContext<MusicContextValues | null>(null);

function usePlaylist(tracks: MusicTrack[]) {
  const player = useAudioPlaylist({
    sources: tracks.map((track) => track.source),
    loop: 'all',
    updateInterval: 1000,
  });
  const status = useAudioPlaylistStatus(player);
  return { player, status };
}

export function MusicProvider({
  children,
  enabled,
}: React.PropsWithChildren<{ enabled: boolean }>) {
  const { isPremium } = usePremium();
  const [meditationRequested, setMeditationRequested] = useState(false);
  const [sportRequested, setSportRequested] = useState(false);
  const requestMeditation = useCallback(() => setMeditationRequested(true), []);
  const requestSport = useCallback(() => setSportRequested(true), []);
  const availableLofiTracks = useMemo(
    () => lofiTracks.filter((track) => isPremium || !track.premium),
    [isPremium],
  );
  const availableMeditationTracks = useMemo(
    () => meditationTracks.filter((track) => isPremium || !track.premium),
    [isPremium],
  );
  const { player: lofiPlayer, status: lofiStatus } = usePlaylist(availableLofiTracks);
  const { player: meditationPlayer, status: meditationStatus } = usePlaylist(
    meditationRequested ? availableMeditationTracks : [],
  );
  const { player: sportPlayer, status: sportStatus } = usePlaylist(
    sportRequested ? sportTracks : [],
  );
  const lofiPlayerRef = useRef(lofiPlayer);
  const meditationPlayerRef = useRef(meditationPlayer);
  const sportPlayerRef = useRef(sportPlayer);
  const [toastVisible, setToastVisible] = useState(false);
  const resumeLofiAfterMeditation = useRef(false);
  const resumeLofiAfterSport = useRef(false);
  const pendingMeditationPlay = useRef(false);
  const pendingSportPlay = useRef(false);

  useEffect(() => {
    lofiPlayerRef.current = lofiPlayer;
    meditationPlayerRef.current = meditationPlayer;
    sportPlayerRef.current = sportPlayer;
  }, [lofiPlayer, meditationPlayer, sportPlayer]);

  const playMeditation = useCallback(() => {
    const activeMeditationPlayer = meditationPlayerRef.current;
    if (activeMeditationPlayer.trackCount === 0) {
      pendingMeditationPlay.current = true;
      return;
    }
    const activeLofiPlayer = lofiPlayerRef.current;
    if (activeLofiPlayer.playing) {
      resumeLofiAfterMeditation.current = true;
      activeLofiPlayer.pause();
    }
    activeMeditationPlayer.play();
  }, []);

  const pauseMeditation = useCallback(() => {
    const activeMeditationPlayer = meditationPlayerRef.current;
    if (activeMeditationPlayer.trackCount > 0) activeMeditationPlayer.pause();
    if (resumeLofiAfterMeditation.current) {
      lofiPlayerRef.current.play();
      resumeLofiAfterMeditation.current = false;
    }
  }, []);
  const playSport = useCallback(() => {
    const activeSportPlayer = sportPlayerRef.current;
    if (activeSportPlayer.trackCount === 0) {
      pendingSportPlay.current = true;
      return;
    }
    const activeLofiPlayer = lofiPlayerRef.current;
    if (activeLofiPlayer.playing) {
      resumeLofiAfterSport.current = true;
      activeLofiPlayer.pause();
    }
    activeSportPlayer.play();
  }, []);
  const pauseSport = useCallback(() => {
    const activeSportPlayer = sportPlayerRef.current;
    if (activeSportPlayer.trackCount > 0) activeSportPlayer.pause();
    if (resumeLofiAfterSport.current) {
      lofiPlayerRef.current.play();
      resumeLofiAfterSport.current = false;
    }
  }, []);

  useEffect(() => {
    if (pendingMeditationPlay.current && meditationPlayer.trackCount > 0) {
      pendingMeditationPlay.current = false;
      playMeditation();
    }
    if (pendingSportPlay.current && sportPlayer.trackCount > 0) {
      pendingSportPlay.current = false;
      playSport();
    }
  }, [meditationPlayer, playMeditation, playSport, sportPlayer]);

  const playLofi = useCallback(() => lofiPlayerRef.current.play(), []);
  const pauseLofi = useCallback(() => lofiPlayerRef.current.pause(), []);
  const selectLofiTrack = useCallback((trackId: string) => {
    const index = availableLofiTracks.findIndex((track) => track.id === trackId);
    if (index < 0) return;
    lofiPlayer.skipTo(index);
    lofiPlayer.play();
  }, [availableLofiTracks, lofiPlayer]);
  const selectMeditationTrack = useCallback((trackId: string) => {
    const index = availableMeditationTracks.findIndex((track) => track.id === trackId);
    if (index < 0) return;
    meditationPlayer.skipTo(index);
    meditationPlayer.play();
  }, [availableMeditationTracks, meditationPlayer]);

  useEffect(() => {
    // expo-audio exposes volume as a mutable player property rather than a setter.
    // eslint-disable-next-line react-hooks/immutability
    lofiPlayer.volume = 0.2;
    // eslint-disable-next-line react-hooks/immutability
    meditationPlayer.volume = 0.55;
    // eslint-disable-next-line react-hooks/immutability
    sportPlayer.volume = 0.55;
  }, [lofiPlayer, meditationPlayer, sportPlayer]);

  useEffect(() => {
    const subscription = lofiPlayer.addListener('trackChanged', () => {
      setToastVisible(true);
    });
    return () => subscription.remove();
  }, [lofiPlayer]);

  useEffect(() => {
    if (!enabled) {
      lofiPlayer.pause();
      return;
    }

    let active = true;
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).then(() => {
      if (active) {
        lofiPlayer.play();
        setToastVisible(true);
      }
    }).catch((error: unknown) => {
      console.warn('Impossible de démarrer la musique Lofi de Qozy.', error);
    });

    return () => {
      active = false;
    };
  }, [enabled, lofiPlayer]);

  useEffect(() => {
    if (!toastVisible) return;
    const timeout = setTimeout(() => setToastVisible(false), 7000);
    return () => clearTimeout(timeout);
  }, [toastVisible, lofiStatus.currentIndex]);

  const lofiIndex = lofiStatus.currentIndex;
  const lofiPlaying = lofiStatus.playing;
  const lofiLoaded = lofiStatus.isLoaded;
  const lofiBuffering = lofiStatus.isBuffering;
  const lofi = useMemo<MusicContextValue>(() => {
    const currentTrack = availableLofiTracks[lofiIndex] ?? availableLofiTracks[0];
    return {
      currentTrack,
      tracks: availableLofiTracks,
      catalog: lofiTracks,
      selectedTrackId: currentTrack.id,
      isPlaying: lofiPlaying,
      isLoaded: lofiLoaded,
      isBuffering: lofiBuffering,
      currentTime: lofiStatus.currentTime,
      duration: lofiStatus.duration,
      isPremium,
      premiumTrackCount: lofiTracks.length - 2,
      selectTrack: selectLofiTrack,
      play: playLofi,
      pause: pauseLofi,
      nextTrack: () => lofiPlayer.next(),
      togglePlayback: () => lofiPlaying ? pauseLofi() : playLofi(),
    };
  }, [
    availableLofiTracks,
    isPremium,
    lofiBuffering,
    lofiStatus.currentTime,
    lofiStatus.duration,
    lofiIndex,
    lofiLoaded,
    lofiPlayer,
    lofiPlaying,
    pauseLofi,
    playLofi,
    selectLofiTrack,
  ]);
  const meditationIndex = meditationStatus.currentIndex;
  const meditationPlaying = meditationStatus.playing;
  const meditationLoaded = meditationStatus.isLoaded;
  const meditationBuffering = meditationStatus.isBuffering;
  const meditation = useMemo<MusicContextValue>(
    () => ({
      currentTrack: availableMeditationTracks[meditationIndex] ?? availableMeditationTracks[0],
      tracks: availableMeditationTracks,
      catalog: meditationTracks,
      selectedTrackId: (availableMeditationTracks[meditationIndex] ?? availableMeditationTracks[0]).id,
      isPlaying: meditationPlaying,
      isLoaded: meditationLoaded,
      isBuffering: meditationBuffering,
      currentTime: meditationStatus.currentTime,
      duration: meditationStatus.duration,
      isPremium,
      premiumTrackCount: meditationTracks.length - 2,
      selectTrack: selectMeditationTrack,
      play: playMeditation,
      pause: pauseMeditation,
      nextTrack: () => meditationPlayer.next(),
      togglePlayback: () => meditationPlaying ? pauseMeditation() : playMeditation(),
    }),
    [
      availableMeditationTracks,
      isPremium,
      meditationBuffering,
      meditationStatus.currentTime,
      meditationStatus.duration,
      meditationIndex,
      meditationLoaded,
      meditationPlayer,
      meditationPlaying,
      pauseMeditation,
      playMeditation,
      selectMeditationTrack,
    ],
  );
  const sportIndex = sportStatus.currentIndex;
  const sportPlaying = sportStatus.playing;
  const sportLoaded = sportStatus.isLoaded;
  const sportBuffering = sportStatus.isBuffering;
  const sport = useMemo<MusicContextValue>(() => ({
    currentTrack: sportTracks[sportIndex] ?? sportTracks[0],
    tracks: sportTracks,
    catalog: sportTracks,
    selectedTrackId: sportTracks[sportIndex]?.id ?? sportTracks[0].id,
    isPlaying: sportPlaying,
    isLoaded: sportLoaded,
    isBuffering: sportBuffering,
    currentTime: sportStatus.currentTime,
    duration: sportStatus.duration,
    isPremium,
    premiumTrackCount: 0,
    selectTrack: () => {},
    play: playSport,
    pause: pauseSport,
    nextTrack: () => sportPlayer.next(),
    togglePlayback: () => sportPlaying ? pauseSport() : playSport(),
  }), [
    isPremium, pauseSport, playSport, sportBuffering, sportIndex, sportLoaded,
    sportPlayer, sportPlaying, sportStatus.currentTime, sportStatus.duration,
  ]);
  const values = useMemo(
    () => ({ lofi, meditation, sport, requestMeditation, requestSport }),
    [lofi, meditation, sport, requestMeditation, requestSport],
  );

  return (
    <MusicContext.Provider value={values}>
      {children}
      {enabled ? <TrackToast value={lofi} visible={toastVisible} /> : null}
    </MusicContext.Provider>
  );
}

export function useMusic(category: MusicCategory = 'lofi') {
  const context = useContext(MusicContext);
  const requestMeditation = context?.requestMeditation;
  const requestSport = context?.requestSport;
  useEffect(() => {
    if (category === 'meditation') requestMeditation?.();
    if (category === 'sport') requestSport?.();
  }, [category, requestMeditation, requestSport]);
  if (!context) throw new Error('useMusic doit être utilisé dans MusicProvider.');
  if (category === 'lofi') return context.lofi;
  if (category === 'meditation') return context.meditation;
  return context.sport;
}

function TrackToast({ value, visible }: { value: MusicContextValue; visible: boolean }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createToastStyles(colors);
  const { time, batteryPercent } = useDeviceStatus();
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
        <Text style={styles.deviceStatus}>
          {time}{batteryPercent === null ? '' : ` · ${batteryPercent}%`}
        </Text>
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
  deviceStatus: { color: palette.textSecondary, fontSize: 8, fontVariant: ['tabular-nums'], marginLeft: spacing.xs },
});
