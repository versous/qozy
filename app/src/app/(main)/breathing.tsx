import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { CosyButton } from '@/components/common/CosyButton';
import { useTimer } from '@/hooks/useTimer';
import { borderRadius, colors, spacing } from '@/theme/colors';

const phases = ['Inspirez', 'Retenez', 'Expirez', 'Retenez'] as const;

export default function BreathingScreen() {
  const { activity: requestedActivity, minutes: requestedMinutes } =
    useLocalSearchParams<{ activity?: string; minutes?: string }>();
  const activity = requestedActivity ?? 'Revenir à soi';
  const parsedMinutes = Number(requestedMinutes);
  const duration = Number.isInteger(parsedMinutes) && parsedMinutes > 0 && parsedMinutes <= 30
    ? parsedMinutes
    : 5;
  const { secondsLeft, isActive, startTimer, pauseTimer, resetTimer } = useTimer(duration);
  const elapsed = duration * 60 - secondsLeft;
  const phaseIndex = Math.floor(elapsed / 4) % phases.length;
  const phaseSecond = secondsLeft === 0 ? 0 : 4 - (elapsed % 4);
  const cycle = Math.min(Math.floor(elapsed / 16) + 1, Math.ceil((duration * 60) / 16));
  const progress = secondsLeft === 0 ? 1 : elapsed / (duration * 60);

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
          <View style={[styles.breathCircle, isActive && styles.breathCircleActive]}>
            <Text style={styles.phaseLabel}>{secondsLeft === 0 ? 'Tout doucement' : phases[phaseIndex]}</Text>
            <Text style={styles.phaseSecond}>{secondsLeft === 0 ? '♡' : phaseSecond}</Text>
            <Text style={styles.secondsLabel}>{secondsLeft === 0 ? 'Tu peux revenir quand tu veux' : 'secondes'}</Text>
          </View>
          <Text style={styles.breathHint}>Inspire 4 s · Retiens 4 s · Expire 4 s · Retiens 4 s</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.cycleLabel}>
            {secondsLeft === 0 ? 'Ta parenthèse est terminée.' : `Cycle ${cycle} sur ${Math.ceil((duration * 60) / 16)}`}
          </Text>
        </View>

        <Text style={styles.encouragement}>Votre petite parenthèse de calme.</Text>
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
            onPress={() => router.replace({ pathname: '/breathing', params: { activity: item.title, minutes: String(item.minutes) } })}
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
            title={secondsLeft === 0 ? 'Recommencer' : isActive ? 'Mettre en pause' : 'Commencer doucement'}
            onPress={() => {
              if (secondsLeft === 0) {
                resetTimer();
                startTimer();
              } else if (isActive) {
                pauseTimer();
              } else {
                startTimer();
              }
            }}
            style={styles.primaryButton}
          />
          {isActive ? (
            <Pressable onPress={resetTimer} style={styles.resetButton}>
              <Text style={styles.resetText}>Recommencer le cycle</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <BottomNavigation active="today" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  back: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  backText: { color: colors.sage, fontSize: 12, fontWeight: '600' },
  brandLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.md },
  brand: { color: colors.textPrimary, fontSize: 27, fontFamily: 'serif', fontWeight: '700' },
  brandCaption: { color: colors.textSecondary, fontSize: 8, letterSpacing: 1, fontWeight: '600' },
  eyebrow: { color: colors.sage, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: colors.textPrimary, fontSize: 26, fontFamily: 'serif', fontWeight: '600', marginTop: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 3, marginBottom: spacing.md },
  breathingCard: { height: 330, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.medium, backgroundColor: colors.sagePale },
  breathingImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  imageScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(248,246,236,0.22)' },
  imageLabel: { position: 'absolute', top: spacing.md, color: colors.sage, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  breathCircle: { width: 178, height: 178, alignItems: 'center', justifyContent: 'center', borderRadius: 89, borderWidth: 1, borderColor: 'rgba(101,121,95,0.25)', backgroundColor: 'rgba(247,244,236,0.92)' },
  breathCircleActive: { borderWidth: 7, borderColor: colors.sageLight },
  phaseLabel: { color: colors.sage, fontSize: 13, fontWeight: '600' },
  phaseSecond: { color: colors.sage, fontSize: 52, fontFamily: 'serif', lineHeight: 60 },
  secondsLabel: { color: colors.textSecondary, fontSize: 9 },
  breathHint: { position: 'absolute', bottom: 42, color: colors.textPrimary, fontSize: 8, textAlign: 'center' },
  progressTrack: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 28, height: 3, borderRadius: 2, backgroundColor: 'rgba(101,121,95,0.2)' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.sage },
  cycleLabel: { position: 'absolute', bottom: 11, color: colors.sage, fontSize: 8, fontWeight: '600' },
  encouragement: { color: colors.textSecondary, fontSize: 11, fontFamily: 'serif', fontStyle: 'italic', textAlign: 'center', marginVertical: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontFamily: 'serif', fontWeight: '600' },
  seeAll: { color: colors.sage, fontSize: 10, fontWeight: '600' },
  audioCard: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: borderRadius.small, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  audioIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.sagePale },
  audioIconText: { color: colors.sage, fontSize: 19 },
  audioCopy: { flex: 1 },
  audioTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  audioSubtitle: { color: colors.textSecondary, fontSize: 9, marginTop: 3 },
  playIcon: { color: colors.sage, fontSize: 17, paddingHorizontal: spacing.xs },
  controls: { alignItems: 'stretch', marginTop: spacing.sm },
  primaryButton: { backgroundColor: colors.sage, borderWidth: 0 },
  resetButton: { alignItems: 'center', padding: spacing.sm },
  resetText: { color: colors.textSecondary, fontSize: 10 },
});
