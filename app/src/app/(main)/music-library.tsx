import { typography } from '@/theme/typography';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useMusic } from '@/services/MusicProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function MusicLibraryScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [category, setCategory] = useState<'lofi' | 'sport'>('lofi');
  const music = useMusic(category);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={styles.backText}>‹  Mon compte</Text>
        </Pressable>
        <Text style={styles.eyebrow}>À TON RYTHME</Text>
        <Text style={styles.title}>Ma bibliothèque musicale</Text>
        <Text style={styles.subtitle}>Choisis une ambiance adaptée à ton activité.</Text>

        <View style={styles.categoryTabs}>
          {([
            { id: 'lofi', label: 'Fond & concentration' },
            { id: 'sport', label: 'Sport' },
          ] as const).map((item) => {
            const selected = category === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategory(item.id)}
                style={[styles.categoryTab, selected && styles.categoryTabSelected]}>
                <Text style={[styles.categoryTabText, selected && styles.categoryTabTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.hero}>
          <ImageBackground
            source={require('@/assets/images/focus-room.jpg')}
            resizeMode="cover"
            style={styles.heroImage}>
            <View style={styles.heroScrim} />
            <Text style={styles.heroIcon}>♫</Text>
            <Text style={styles.heroTitle}>{category === 'sport' ? 'Énergie pour bouger' : 'Ambiance Lofi'}</Text>
            <Text style={styles.heroTrack} numberOfLines={1}>{music.currentTrack.title}</Text>
          </ImageBackground>
        </View>

        <View style={styles.nowPlaying}>
          <View style={styles.nowPlayingCopy}>
            <Text style={styles.nowPlayingLabel}>{music.isBuffering ? 'CHARGEMENT…' : music.isLoaded ? 'PRÊTE À ÉCOUTER' : 'PRÉPARATION DU TITRE'}</Text>
            <Text style={styles.nowPlayingTitle} numberOfLines={1}>{music.currentTrack.title}</Text>
            <Text style={styles.nowPlayingArtist}>{music.currentTrack.artist}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={music.isPlaying ? 'Mettre en pause' : 'Écouter le titre'}
            onPress={music.togglePlayback}
            style={styles.playButton}>
            <Text style={styles.playButtonText}>{music.isPlaying ? 'Ⅱ' : '▷'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Passer au titre suivant"
            onPress={music.nextTrack}
            style={styles.skipButton}>
            <Text style={styles.skipButtonText}>»</Text>
          </Pressable>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>Les titres</Text>
          <Text style={styles.sectionMeta}>
            {category === 'sport'
              ? `${music.catalog.length} titre${music.catalog.length > 1 ? 's' : ''} inclus`
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
              accessibilityState={{ selected, disabled: false }}
              onPress={() => {
                if (isLocked) {
                  router.push('/premium');
                } else {
                  music.selectTrack(track.id);
                }
              }}
              style={[styles.trackRow, selected && styles.trackSelected, isLocked && styles.trackLocked]}>
              <View style={[styles.trackIcon, selected && styles.trackIconSelected]}>
                <Text style={styles.trackIconText}>{selected ? '♫' : '♪'}</Text>
              </View>
              <View style={styles.trackCopy}>
                <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.trackArtist}>{track.artist}</Text>
              </View>
              {isLocked ? (
                <View style={styles.lockBadge}>
                  <Text style={styles.lockText}>PREMIUM</Text>
                </View>
              ) : selected ? (
                <Text style={styles.selectedLabel}>CHOISI</Text>
              ) : null}
            </Pressable>
          );
        })}
        <Text style={styles.footer}>
          Le Lofi accompagne l’application en fond. La musique de sport démarre avec tes séances d’exercice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  back: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backText: { color: palette.sage, fontSize: 12, fontWeight: '600' },
  eyebrow: { color: palette.sage, fontSize: 9, letterSpacing: 0.8, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 25, lineHeight: 31, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 4 },
  subtitle: { color: palette.textSecondary, fontSize: 11, lineHeight: 17, marginTop: spacing.xs, marginBottom: spacing.md },
  categoryTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  categoryTab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  categoryTabSelected: { backgroundColor: palette.sage, borderColor: palette.sage },
  categoryTabText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600' },
  categoryTabTextSelected: { color: palette.surface },
  hero: { height: 150, overflow: 'hidden', borderRadius: borderRadius.medium, marginBottom: spacing.md },
  heroImage: { flex: 1, justifyContent: 'flex-end', padding: spacing.md },
  heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(24, 31, 25, 0.38)' },
  heroIcon: { color: '#FFFDF7', fontSize: 22 },
  heroTitle: { color: '#FFFDF7', fontSize: 17, fontFamily: typography.fonts.display, fontWeight: '700', marginTop: 2 },
  heroTrack: { color: '#FFFDF7', fontSize: 9, marginTop: 3 },
  nowPlaying: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  nowPlayingCopy: { flex: 1 },
  nowPlayingLabel: { color: palette.sage, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  nowPlayingTitle: { color: palette.textPrimary, fontSize: 10, fontWeight: '700', marginTop: 3 },
  nowPlayingArtist: { color: palette.textSecondary, fontSize: 9, marginTop: 2 },
  playButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: palette.sage },
  playButtonText: { color: palette.surface, fontSize: 14, fontWeight: '700' },
  skipButton: { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' },
  skipButtonText: { color: palette.sage, fontSize: 19, fontWeight: '700' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 16, fontFamily: typography.fonts.display, fontWeight: '600' },
  sectionMeta: { color: palette.textSecondary, fontSize: 9 },
  trackRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.xs },
  trackSelected: { borderColor: palette.sage, backgroundColor: palette.sagePale },
  trackLocked: { opacity: 0.68 },
  trackIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.peachLight },
  trackIconSelected: { backgroundColor: palette.sageLight },
  trackIconText: { color: palette.sage, fontSize: 17, fontWeight: '700' },
  trackCopy: { flex: 1 },
  trackTitle: { color: palette.textPrimary, fontSize: 10, fontWeight: '700' },
  trackArtist: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  selectedLabel: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  lockBadge: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: borderRadius.extraLarge, backgroundColor: palette.peachLight },
  lockText: { color: palette.clay, fontSize: 7, fontWeight: '700' },
  footer: { color: palette.textSecondary, fontSize: 9, lineHeight: 15, marginTop: spacing.md, textAlign: 'center' },
});
