import { typography } from '@/theme/typography';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { CosyButton } from '@/components/common/CosyButton';
import { useMusic } from '@/services/MusicProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function BreathingScreen() {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const { activity: requestedActivity, minutes: requestedMinutes } =
    useLocalSearchParams<{ activity?: string; minutes?: string }>();
  const [activity, setActivity] = useState(requestedActivity ?? 'Méditer');
  const parsedMinutes = Number(requestedMinutes);
  const initialDuration = Number.isInteger(parsedMinutes) && parsedMinutes > 0 && parsedMinutes <= 60
    ? parsedMinutes
    : 10;
  const [duration, setDuration] = useState(initialDuration);
  const music = useMusic('meditation');
  const pauseMeditation = music.pause;

  useEffect(() => () => pauseMeditation(), [pauseMeditation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Text style={styles.backText}>‹  Aujourd’hui</Text>
        </Pressable>
        <View style={styles.brandLine}>
          <Text style={styles.brand}>nid</Text>
          <Text style={styles.brandCaption}>À VOTRE RYTHME</Text>
        </View>
        <Text style={styles.eyebrow}>UNE PAUSE POUR TOI</Text>
        <Text style={styles.title}>{activity}</Text>
        <Text style={styles.subtitle}>Rien à réussir. Juste être là.</Text>

        <View style={styles.breathingCard}>
          <Image
            source={require('@/assets/images/breathing-room.jpg')}
            resizeMode="cover"
            style={styles.breathingImage}
            accessibilityLabel="Une personne médite dans un espace calme"
          />
          <View style={styles.imageScrim} />
          <Text style={styles.imageLabel}>RESPIRATION CARRÉE</Text>
          <View style={styles.breathCircle}>
            <Text style={styles.phaseLabel}>Un instant pour toi</Text>
            <Text style={styles.phaseSecond}>♡</Text>
            <Text style={styles.secondsLabel}>Respire à ton rythme</Text>
          </View>
        </View>

        <Text style={styles.encouragement}>Votre petite parenthèse de calme.</Text>
        <View style={styles.musicCard}>
          <View style={styles.musicCopy}>
            <Text style={styles.musicTitle} numberOfLines={1}>{music.currentTrack.title}</Text>
            <Text style={styles.musicSubtitle}>{music.currentTrack.artist} · Musique en boucle</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={music.isPlaying ? 'Mettre la musique en pause' : 'Reprendre la musique'}
            onPress={music.togglePlayback}
            style={styles.musicButton}>
            <Text style={styles.musicButtonText}>{music.isPlaying ? 'Ⅱ  Pause' : '▷  Écouter'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Passer à la musique de méditation suivante"
            onPress={music.nextTrack}
            style={styles.musicButton}>
            <Text style={styles.musicButtonText}>»</Text>
          </Pressable>
        </View>
        <Text style={styles.musicAvailability}>
          {music.isPremium
            ? 'Tous les titres de méditation Premium sont disponibles.'
            : '2 titres inclus · 2 titres supplémentaires avec Premium.'}
        </Text>
        {!music.isPremium ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/premium')}
            style={styles.premiumMusicLink}>
            <Text style={styles.premiumMusicLinkText}>Découvrir les musiques Premium ›</Text>
          </Pressable>
        ) : null}
        <Text style={styles.durationHeading}>Combien de temps pour toi ?</Text>
        <View style={styles.durationOptions}>
          {[5, 10, 15, 20, 30, 45, 60].map((minutes) => (
            <Pressable
              key={minutes}
              accessibilityRole="radio"
              accessibilityState={{ selected: duration === minutes }}
              onPress={() => setDuration(minutes)}
              style={[styles.durationOption, duration === minutes && styles.durationOptionSelected]}>
              <Text style={[styles.durationText, duration === minutes && styles.durationTextSelected]}>
                {minutes} min
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>À écouter, à votre rythme</Text>
          <Text style={styles.seeAll}>Tout voir</Text>
        </View>
        {[
          { title: 'Faire de la place', subtitle: 'Apaiser le mental', minutes: 5, icon: '☼' },
          { title: 'Déposer sa journée', subtitle: 'Relâcher les tensions', minutes: 10, icon: '☾' },
        ].map((item) => (
          <Pressable
            key={item.title}
            onPress={() => {
              setActivity(item.title);
              setDuration(item.minutes);
            }}
            style={styles.audioCard}>
            <View style={styles.audioIcon}><Text style={styles.audioIconText}>{item.icon}</Text></View>
            <View style={styles.audioCopy}>
              <Text style={styles.audioTitle}>{item.title}</Text>
              <Text style={styles.audioSubtitle}>{item.subtitle} · {item.minutes} min</Text>
            </View>
            <Text style={styles.playIcon}>▷</Text>
          </Pressable>
        ))}

        <View style={styles.controls}>
          <CosyButton
            title="Commencer doucement"
            onPress={() => router.push({
              pathname: '/activity-ready',
              params: { activity, minutes: String(duration), category: 'meditation' },
            })}
            style={styles.primaryButton}
          />
        </View>
      </ScrollView>
      <BottomNavigation active="today" />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  back: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  backText: { color: palette.sage, fontSize: 12, fontWeight: '600' },
  brandLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.md },
  brand: { color: palette.textPrimary, fontSize: 27, fontFamily: typography.fonts.display, fontWeight: '700' },
  brandCaption: { color: palette.textSecondary, fontSize: 8, letterSpacing: 1, fontWeight: '600' },
  eyebrow: { color: palette.sage, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: palette.textPrimary, fontSize: 26, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 4 },
  subtitle: { color: palette.textSecondary, fontSize: 12, marginTop: 3, marginBottom: spacing.md },
  breathingCard: { height: 330, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  breathingImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  imageScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.16)' },
  imageLabel: { position: 'absolute', top: spacing.md, color: palette.sage, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  breathCircle: { width: 178, height: 178, alignItems: 'center', justifyContent: 'center', borderRadius: 89, borderWidth: 1, borderColor: palette.sage, backgroundColor: palette.surface },
  phaseLabel: { color: palette.sage, fontSize: 13, fontWeight: '600' },
  phaseSecond: { color: palette.sage, fontSize: 52, fontFamily: typography.fonts.display, lineHeight: 60 },
  secondsLabel: { color: palette.textSecondary, fontSize: 9 },
  encouragement: { color: palette.textSecondary, fontSize: 11, fontFamily: typography.fonts.display, fontStyle: 'italic', textAlign: 'center', marginVertical: spacing.md },
  musicCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.peachLight, marginBottom: spacing.md },
  musicCopy: { flex: 1, gap: 4 },
  musicTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  musicSubtitle: { color: palette.textSecondary, fontSize: 9, lineHeight: 14 },
  musicButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  musicButtonText: { color: palette.surface, fontSize: 9, fontWeight: '700' },
  musicAvailability: { color: palette.textSecondary, fontSize: 9, marginTop: -spacing.sm, marginBottom: spacing.xs },
  premiumMusicLink: { alignSelf: 'flex-start', marginBottom: spacing.md, paddingVertical: spacing.xs },
  premiumMusicLinkText: { color: palette.sage, fontSize: 10, fontWeight: '700' },
  durationHeading: { color: palette.textPrimary, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs },
  durationOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  durationOption: { minWidth: 48, alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  durationOptionSelected: { backgroundColor: palette.sage, borderColor: palette.sage },
  durationText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600' },
  durationTextSelected: { color: palette.surface },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 15, fontFamily: typography.fonts.display, fontWeight: '600' },
  seeAll: { color: palette.sage, fontSize: 10, fontWeight: '600' },
  audioCard: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.small, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginBottom: spacing.xs },
  audioIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: palette.sagePale },
  audioIconText: { color: palette.sage, fontSize: 19 },
  audioCopy: { flex: 1 },
  audioTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '600' },
  audioSubtitle: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  playIcon: { color: palette.sage, fontSize: 17, paddingHorizontal: spacing.xs },
  controls: { alignItems: 'stretch', marginTop: spacing.sm },
  primaryButton: { backgroundColor: palette.sage, borderWidth: 0 },
});
