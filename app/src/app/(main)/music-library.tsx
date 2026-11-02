import { typography } from '@/theme/typography';
import React, { useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { useMusic } from '@/services/MusicProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

type MusicMood = 'lofi' | 'nature' | 'piano' | 'sport';

const MOODS: { id: MusicMood; label: string; icon: string }[] = [
  { id: 'lofi', label: 'Lofi', icon: '♫' },
  { id: 'nature', label: 'Nature', icon: '♧' },
  { id: 'piano', label: 'Piano', icon: '▥' },
  { id: 'sport', label: 'Sport', icon: '⌁' },
];

function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export default function MusicLibraryScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [mood, setMood] = useState<MusicMood>('lofi');
  const music = useMusic(mood === 'sport' ? 'sport' : mood === 'lofi' ? 'lofi' : 'meditation');
  const progress = music.duration > 0
    ? Math.min(100, (music.currentTime / music.duration) * 100)
    : 0;
  const isSport = mood === 'sport';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.back}>
          <Text style={styles.backText}>‹  Aujourd’hui</Text>
        </Pressable>
        <Text style={styles.title}>La bande-son de ton Nid</Text>
        <Text style={styles.subtitle}>Des sons pour habiter l’instant.</Text>

        <ImageBackground
          source={isSport
            ? require('@/assets/images/exercise-room.jpg')
            : mood === 'nature'
              ? require('@/assets/images/breathing-room.jpg')
              : require('@/assets/images/focus-room.jpg')}
          resizeMode="cover"
          imageStyle={styles.heroImageStyle}
          style={styles.hero}>
          <View style={styles.heroScrim} />
          <Text style={styles.heroTitle} numberOfLines={1}>{music.currentTrack.title}</Text>
          <Text style={styles.heroArtist}>{music.currentTrack.artist} · {music.isBuffering ? 'Chargement…' : 'Inclus gratuitement'}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={music.isPlaying ? 'Mettre en pause' : 'Écouter le titre'}
            onPress={music.togglePlayback}
            style={styles.heroPlayButton}>
            <Text style={styles.heroPlayText}>{music.isPlaying ? 'Ⅱ' : '▷'}</Text>
          </Pressable>
        </ImageBackground>

        <View style={styles.moodHeading}>
          <Text style={styles.sectionTitle}>À chaque envie, son univers</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moodList}>
          {MOODS.map((item) => {
            const selected = mood === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setMood(item.id)}
                style={[styles.moodCard, selected && styles.moodCardSelected]}>
                <Text style={[styles.moodIcon, selected && styles.moodIconSelected]}>{item.icon}</Text>
                <Text style={[styles.moodLabel, selected && styles.moodLabelSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/breathing')}
            style={styles.moodCard}>
            <Text style={styles.moodIcon}>≋</Text>
            <Text style={styles.moodLabel}>Respiration</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>
            {isSport ? 'Musique pour bouger' : `${mood === 'nature' ? 'Nature' : mood === 'piano' ? 'Piano & calme' : 'Lofi'} · Musique sans paroles`}
          </Text>
          <Text style={styles.sectionMeta}>
            {isSport
              ? `${music.catalog.length} ambiance`
              : music.isPremium ? 'Catalogue complet' : `2 inclus · ${music.premiumTrackCount} Premium`}
          </Text>
        </View>

        {music.catalog.map((track) => {
          const isLocked = Boolean(track.premium && !music.isPremium);
          const selected = music.selectedTrackId === track.id;
          return (
            <Pressable
              key={track.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={isLocked ? `${track.title}, Premium` : `${track.title}, ${selected && music.isPlaying ? 'en cours de lecture' : 'écouter'}`}
              onPress={() => {
                if (isLocked) router.push('/premium');
                else music.selectTrack(track.id);
              }}
              style={[styles.trackRow, selected && styles.trackSelected, isLocked && styles.trackLocked]}>
              <View style={[styles.trackIcon, selected && styles.trackIconSelected]}>
                <Text style={styles.trackIconText}>{selected ? '♫' : '♪'}</Text>
              </View>
              <View style={styles.trackCopy}>
                <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {track.artist} · {isLocked ? 'Premium' : selected ? 'Inclus · Sélectionné' : 'Inclus gratuitement'}
                </Text>
              </View>
              {isLocked ? (
                <Text style={styles.lockIcon}>✧</Text>
              ) : (
                <Text style={styles.trackAction}>
                  {selected && music.isPlaying ? 'Ⅱ' : '▷'}
                </Text>
              )}
            </Pressable>
          );
        })}

        {!isSport ? (
          <View style={styles.breathingCard}>
            <Text style={styles.breathingIcon}>≋</Text>
            <View style={styles.breathingCopy}>
              <Text style={styles.breathingTitle}>Respirer, ce n’est pas une playlist</Text>
              <Text style={styles.breathingText}>Respiration carrée · 5 cycles · Guide visuel et vocal, sans musique imposée.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/breathing')}>
                <Text style={styles.breathingLink}>Ouvrir la respiration guidée  →</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.footer}>
          {music.isPremium
            ? 'Toute la bibliothèque est disponible avec Premium.'
            : 'Lofi et ambiance méditative inclus. D’autres titres sont réservés à Premium.'}
        </Text>
      </ScrollView>

      <View style={styles.player}>
        <View style={styles.playerTop}>
          <View style={styles.cover}>
            <Text style={styles.coverText}>{isSport ? '⌁' : mood === 'nature' ? '♧' : '♫'}</Text>
          </View>
          <View style={styles.playerCopy}>
            <Text style={styles.playerTitle} numberOfLines={1}>{music.currentTrack.title}</Text>
            <Text style={styles.playerSubtitle} numberOfLines={1}>
              {music.isBuffering ? 'Chargement en cours' : `${music.currentTrack.artist} · ${music.isPlaying ? 'Lecture en cours' : 'En pause'}`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={music.isPlaying ? 'Mettre en pause' : 'Reprendre la lecture'}
            onPress={music.togglePlayback}
            style={styles.playerButton}>
            <Text style={styles.playerButtonText}>{music.isPlaying ? 'Ⅱ' : '▷'}</Text>
          </Pressable>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.playerBottom}>
          <Text style={styles.playerTime}>{formatTime(music.currentTime)}</Text>
          <View style={styles.playerMeta}>
            <Text style={styles.playerMetaText}>◖  {music.isPlaying ? 'Lecture' : 'En pause'}</Text>
            <Pressable accessibilityRole="button" onPress={music.nextTrack}>
              <Text style={styles.playerMetaText}>Suivant  »</Text>
            </Pressable>
          </View>
          <Text style={styles.playerTime}>{formatTime(music.duration)}</Text>
        </View>
      </View>
      <BottomNavigation active="today" />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.md },
  back: { alignSelf: 'flex-start', marginTop: spacing.xs, marginBottom: spacing.sm },
  backText: { color: palette.sage, fontSize: 9, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 22, lineHeight: 29, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 2 },
  subtitle: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: 2, marginBottom: spacing.md },
  hero: { height: 164, justifyContent: 'flex-end', overflow: 'hidden', padding: spacing.sm, borderRadius: borderRadius.medium },
  heroImageStyle: { borderRadius: borderRadius.medium },
  heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(24, 31, 25, 0.18)' },
  heroTitle: { maxWidth: '80%', color: '#FFFDF7', fontSize: 15, fontFamily: typography.fonts.display, fontWeight: '700' },
  heroArtist: { maxWidth: '80%', color: '#FFFDF7', fontSize: 8, marginTop: 2 },
  heroPlayButton: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: palette.sage },
  heroPlayText: { color: palette.surface, fontSize: 14, fontWeight: '700' },
  moodHeading: { marginTop: spacing.md, marginBottom: spacing.xs },
  sectionTitle: { color: palette.textPrimary, fontSize: 14, fontFamily: typography.fonts.display, fontWeight: '600' },
  moodList: { gap: spacing.xs, paddingBottom: 2 },
  moodCard: { width: 58, height: 59, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.small, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  moodCardSelected: { backgroundColor: palette.sage, borderColor: palette.sage },
  moodIcon: { color: palette.sage, fontSize: 16 },
  moodIconSelected: { color: palette.surface },
  moodLabel: { color: palette.textPrimary, fontSize: 7, fontWeight: '600', marginTop: 4 },
  moodLabelSelected: { color: palette.surface },
  listHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.xs },
  sectionMeta: { color: palette.sage, fontSize: 7, fontWeight: '700' },
  trackRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, borderRadius: borderRadius.small, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.xs },
  trackSelected: { borderColor: palette.sage, backgroundColor: palette.sagePale },
  trackLocked: { opacity: 0.72 },
  trackIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: palette.peachLight },
  trackIconSelected: { backgroundColor: palette.sageLight },
  trackIconText: { color: palette.sage, fontSize: 14, fontWeight: '700' },
  trackCopy: { flex: 1, minWidth: 0 },
  trackTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  trackArtist: { color: palette.textSecondary, fontSize: 7, marginTop: 3 },
  trackAction: { color: palette.sage, fontSize: 16, paddingHorizontal: spacing.xs },
  lockIcon: { color: palette.clay, fontSize: 15, paddingHorizontal: spacing.xs },
  breathingCard: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, marginTop: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.peachLight },
  breathingIcon: { color: palette.clay, fontSize: 16 },
  breathingCopy: { flex: 1 },
  breathingTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  breathingText: { color: palette.textSecondary, fontSize: 7, lineHeight: 11, marginTop: 3 },
  breathingLink: { color: palette.sage, fontSize: 7, fontWeight: '700', marginTop: 4 },
  footer: { color: palette.textSecondary, fontSize: 7, lineHeight: 11, marginTop: spacing.sm, marginBottom: spacing.xs },
  player: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: palette.sagePale, borderTopLeftRadius: borderRadius.medium, borderTopRightRadius: borderRadius.medium },
  playerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cover: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 16, backgroundColor: palette.surface },
  coverText: { color: palette.sage, fontSize: 14 },
  playerCopy: { flex: 1, minWidth: 0 },
  playerTitle: { color: palette.textPrimary, fontSize: 8, fontWeight: '700' },
  playerSubtitle: { color: palette.textSecondary, fontSize: 7, marginTop: 2 },
  playerButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: palette.sage },
  playerButtonText: { color: palette.surface, fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 4, overflow: 'hidden', borderRadius: borderRadius.extraLarge, backgroundColor: palette.border, marginTop: spacing.sm },
  progressFill: { height: '100%', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  playerBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  playerTime: { color: palette.textSecondary, fontSize: 7, fontVariant: ['tabular-nums'] },
  playerMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  playerMetaText: { color: palette.textSecondary, fontSize: 7 },
});
