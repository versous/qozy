import { typography } from '@/theme/typography';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BottomNavigation } from '@/components/BottomNavigation';
import { useHydration } from '@/hooks/useHydration';
import { usePremium } from '@/services/PremiumProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

const CUP_SIZES = [
  { milliliters: 100, label: 'Petit verre', shape: 'shot' as const },
  { milliliters: 150, label: 'Tasse', shape: 'mug' as const },
  { milliliters: 200, label: 'Verre', shape: 'glass' as const },
  { milliliters: 300, label: 'Grand verre', shape: 'tumbler' as const },
  { milliliters: 500, label: 'Gourde', shape: 'bottle' as const },
];

const BENEFITS = [
  {
    icon: '◉',
    title: 'Un équilibre essentiel',
    detail: 'L’eau participe au maintien des fonctions normales du corps, notamment à la régulation de sa température.',
  },
  {
    icon: '↗',
    title: 'Un soutien au quotidien',
    detail: 'Une hydratation adaptée contribue au transport des nutriments et au fonctionnement normal de l’organisme.',
  },
  {
    icon: '☼',
    title: 'Écoute tes besoins',
    detail: 'Les besoins varient selon les personnes, l’activité, la météo, l’alimentation et la santé. Ton repère n’est pas une obligation.',
  },
];

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatLiters(milliliters: number) {
  return `${(milliliters / 1000).toLocaleString('fr-FR', {
    minimumFractionDigits: milliliters % 1000 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  })} L`;
}

function formatDateLabel(dateKey: string, today: string) {
  if (dateKey === today) return 'Aujourd’hui';
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getWeekDays(today: string) {
  const date = new Date(`${today}T12:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDate(date, index - 6);
    return {
      date: getDateKey(day),
      label: day.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
      dayNumber: day.getDate(),
    };
  });
}

export default function HydrationScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { isPremium } = usePremium();
  const hydration = useHydration();
  const [isAddingWater, setIsAddingWater] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const dateObject = new Date(`${hydration.selectedDate}T12:00:00`);
  const currentTotal = hydration.milliliters;
  const progress = Math.min(100, Math.round(
    (currentTotal / hydration.dailyGoalMilliliters) * 100
  ));
  const remaining = Math.max(0, hydration.dailyGoalMilliliters - currentTotal);
  const weekDays = useMemo(() => getWeekDays(hydration.today), [hydration.today]);
  const weekMax = Math.max(
    hydration.dailyGoalMilliliters,
    ...weekDays.map((day) => hydration.dailyTotals.get(day.date) ?? 0),
    1
  );
  const isToday = hydration.selectedDate === hydration.today;

  const changeDate = (amount: number) => {
    const nextDate = shiftDate(dateObject, amount);
    const nextDateKey = getDateKey(nextDate);
    if (nextDateKey > hydration.today) return;
    if (!isPremium && nextDateKey !== hydration.today) {
      router.push('/premium');
      return;
    }
    hydration.setSelectedDate(nextDateKey);
  };

  const addWater = async (milliliters: number): Promise<boolean> => {
    setIsAddingWater(true);
    try {
      await hydration.addWater(milliliters);
      return true;
    } catch (reason) {
      Alert.alert(
        'Prise non enregistrée',
        reason instanceof Error ? reason.message : 'Réessaie plus tard.'
      );
      return false;
    } finally {
      setIsAddingWater(false);
    }
  };
  const addCustomWater = () => {
    const amount = Number(customAmount);
    if (!/^\d+$/.test(customAmount) || amount < 50 || amount > 5000) {
      Alert.alert('Quantité à vérifier', 'Entre une quantité comprise entre 50 et 5 000 ml.');
      return;
    }
    void addWater(amount).then((saved) => {
      if (saved) setCustomAmount('');
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹  Aujourd’hui</Text>
        </Pressable>
        <Text style={styles.eyebrow}>À TON RYTHME</Text>
        <Text style={styles.title}>Mon hydratation</Text>
        <Text style={styles.subtitle}>Un petit verre à la fois, sans pression.</Text>

        <View style={styles.progressCard}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`Hydratation ${formatLiters(currentTotal)} sur ${formatLiters(hydration.dailyGoalMilliliters)}`}
            accessibilityValue={{ min: 0, max: 100, now: progress }}
            style={styles.progressRing}>
            {Array.from({ length: 56 }, (_, index) => {
              const angle = (index / 56) * Math.PI * 2 - Math.PI / 2;
              const left = 96 + Math.cos(angle) * 83 - 3;
              const top = 96 + Math.sin(angle) * 83 - 3;
              return (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    {
                      left,
                      top,
                      backgroundColor: index < Math.round(progress * 0.56)
                        ? colors.sage
                        : colors.sagePale,
                    },
                  ]}
                />
              );
            })}
            <View style={styles.ringCenter}>
              <Text style={styles.ringIcon}>◉</Text>
              <Text style={styles.ringAmount}>{formatLiters(currentTotal)}</Text>
              <Text style={styles.ringGoal}>sur {formatLiters(hydration.dailyGoalMilliliters)}</Text>
            </View>
          </View>
          <View style={styles.dateSelector}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Jour précédent"
              disabled={!isPremium}
              onPress={() => changeDate(-1)}
              style={[styles.dateArrow, !isPremium && styles.disabledControl]}>
              <Text style={styles.dateArrowText}>‹</Text>
            </Pressable>
            <View style={styles.dateLabelWrap}>
              <Text style={styles.dateLabel}>
                {formatDateLabel(hydration.selectedDate, hydration.today)}
              </Text>
              <Text style={styles.dateHint}>{isToday ? 'Ton suivi du jour' : 'Consultation de l’historique'}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Jour suivant"
              disabled={isToday}
              onPress={() => changeDate(1)}
              style={[styles.dateArrow, isToday && styles.disabledControl]}>
              <Text style={styles.dateArrowText}>›</Text>
            </Pressable>
          </View>
          <Text style={styles.remainingText}>
            {hydration.loading
              ? 'On prépare ton suivi…'
              : !isPremium
                ? 'L’historique des jours précédents est disponible avec Premium.'
              : remaining > 0
                ? `Encore ${formatLiters(remaining)} pour atteindre ton repère indicatif.`
                : 'Ton repère indicatif est atteint. À ton rythme.'}
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Ajouter un verre</Text>
            <Text style={styles.sectionSubtitle}>Choisis la taille qui te convient.</Text>
          </View>
        </View>
        <View style={styles.cupGrid}>
          {CUP_SIZES.map((cup) => (
            <Pressable
              key={cup.milliliters}
              accessibilityRole="button"
              accessibilityLabel={`Ajouter une prise de ${cup.milliliters} millilitres`}
              disabled={!isToday || hydration.loading || isAddingWater}
              onPress={() => void addWater(cup.milliliters)}
              style={[
                styles.cupButton,
                !isToday && styles.disabledControl,
                isToday && !isAddingWater && styles.cupButtonActive,
              ]}>
              <CupIllustration shape={cup.shape} styles={styles} />
              <Text style={styles.cupAmount}>{cup.milliliters} ml</Text>
              <Text style={styles.cupLabel}>{cup.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.customAmountCard}>
          <View style={styles.customAmountCopy}>
            <Text style={styles.customAmountTitle}>Une autre quantité ?</Text>
            <Text style={styles.customAmountHint}>Entre ton volume en millilitres (50 à 5 000 ml).</Text>
          </View>
          <View style={styles.customAmountControls}>
            <TextInput
              accessibilityLabel="Quantité d’eau personnalisée en millilitres"
              value={customAmount}
              onChangeText={(value) => setCustomAmount(value.replace(/[^\d]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder="Ex. 350"
              placeholderTextColor={colors.textLight}
              maxLength={4}
              style={styles.customAmountInput}
            />
            <Text style={styles.customAmountUnit}>ml</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter la quantité personnalisée"
              disabled={!isToday || hydration.loading || isAddingWater || !customAmount}
              onPress={addCustomWater}
              style={[styles.customAmountButton, (!isToday || hydration.loading || isAddingWater || !customAmount) && styles.disabledControl]}>
              <Text style={styles.customAmountButtonText}>Ajouter</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.guidanceNote}>
          Le repère de 2 L est indicatif, pas un objectif médical : les besoins en eau diffèrent selon chacun.
        </Text>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Les prises de la journée</Text>
            <Text style={styles.sectionSubtitle}>{formatDateLabel(hydration.selectedDate, hydration.today)}</Text>
          </View>
          {isToday && hydration.selectedEntries.length ? (
            <Pressable
              accessibilityRole="button"
              disabled={hydration.loading || isAddingWater}
              onPress={() => {
                void hydration.undoLastEntry().catch((reason: unknown) => {
                  Alert.alert(
                    'Suppression impossible',
                    reason instanceof Error ? reason.message : 'Réessaie plus tard.'
                  );
                });
              }}>
              <Text style={styles.undoText}>Annuler la dernière</Text>
            </Pressable>
          ) : null}
        </View>
        {hydration.loading ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : hydration.selectedEntries.length ? (
          hydration.selectedEntries.map((entry) => (
            <View key={entry.id} style={styles.recordRow}>
              <View style={styles.recordIcon}><Text style={styles.recordIconText}>◉</Text></View>
              <View style={styles.recordCopy}>
                <Text style={styles.recordTitle}>{formatTime(entry.createdAt)}</Text>
                <Text style={styles.recordSubtitle}>Eau · {formatLiters(entry.milliliters)}</Text>
              </View>
              <Text style={styles.recordAmount}>{entry.milliliters} ml</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucune prise enregistrée</Text>
            <Text style={styles.emptyText}>Tu peux ajouter un verre quand tu le souhaites.</Text>
          </View>
        )}
        {hydration.error ? <Text style={styles.errorText}>{hydration.error}</Text> : null}

        <View style={styles.premiumSection}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.eyebrow}>QOZY PREMIUM</Text>
              <Text style={styles.sectionTitle}>Mon historique d’hydratation</Text>
            </View>
          </View>
          {isPremium ? (
            <>
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>Cette semaine</Text>
                <Text style={styles.statsSubtitle}>Volume d’eau enregistré, jour après jour.</Text>
                <View style={styles.chart}>
                  {weekDays.map((day) => {
                    const amount = hydration.dailyTotals.get(day.date) ?? 0;
                    const barHeight = amount > 0
                      ? Math.max(8, Math.round((amount / weekMax) * 105))
                      : 4;
                    return (
                      <View key={day.date} style={styles.chartDay}>
                        <Text style={styles.chartAmount}>
                          {amount >= 1000 ? formatLiters(amount) : amount ? `${amount} ml` : ''}
                        </Text>
                        <View style={styles.chartTrack}>
                          <View style={[styles.chartBar, { height: barHeight }]} />
                        </View>
                        <Text style={styles.chartLabel}>{day.label}</Text>
                        <Text style={styles.chartDayNumber}>{day.dayNumber}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={styles.benefitsCard}>
                <View style={styles.wellnessIllustration} accessibilityLabel="Illustration apaisante de soleil, collines et eau">
                  <View style={styles.illustrationSun} />
                  <View style={styles.illustrationHillBack} />
                  <View style={styles.illustrationHillFront} />
                  <View style={styles.illustrationWater}>
                    <View style={styles.illustrationWave} />
                  </View>
                  <View style={styles.illustrationDrop}>
                    <View style={styles.illustrationDropShine} />
                  </View>
                  <Text style={styles.illustrationCaption}>Un instant pour prendre soin de soi</Text>
                </View>
                <Text style={styles.wellnessTitle}>L’eau, un geste de douceur</Text>
                <Text style={styles.wellnessIntro}>
                  Boire selon ses besoins accompagne le fonctionnement naturel du corps. Voici quelques repères pour mieux comprendre, sans pression.
                </Text>
                {BENEFITS.map((benefit) => (
                  <View key={benefit.title} style={styles.benefitRow}>
                    <View style={styles.benefitIcon}><Text style={styles.benefitIconText}>{benefit.icon}</Text></View>
                    <View style={styles.benefitCopy}>
                      <Text style={styles.benefitTitle}>{benefit.title}</Text>
                      <Text style={styles.benefitDetail}>{benefit.detail}</Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.disclaimer}>
                  Ces informations sont générales et ne remplacent pas un avis médical. En cas de consigne liée à ta santé, suis les conseils d’un professionnel.
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.premiumCard}>
              <View style={styles.premiumBadge}><Text style={styles.premiumBadgeText}>✦ PREMIUM</Text></View>
              <Text style={styles.premiumTitle}>Retrouve tes jours précédents</Text>
              <Text style={styles.premiumText}>
                Consulte les volumes enregistrés sur la semaine et découvre des repères doux sur le rôle de l’eau pour le corps.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/premium')}
                style={styles.premiumButton}>
                <Text style={styles.premiumButtonText}>Découvrir Premium</Text>
              </Pressable>
            </View>
          )}
        </View>
        <Text style={styles.localNote}>Ton suivi est enregistré sur cet appareil.</Text>
      </ScrollView>
      <BottomNavigation active="today" />
    </SafeAreaView>
  );
}

function CupIllustration({
  shape,
  styles,
}: {
  shape: typeof CUP_SIZES[number]['shape'];
  styles: ReturnType<typeof createStyles>;
}) {
  if (shape === 'bottle') {
    return (
      <View style={styles.cupIllustration}>
        <View style={styles.cupBottleNeck} />
        <View style={styles.cupBottleBody}>
          <View style={[styles.cupWater, { height: '58%' }]} />
        </View>
      </View>
    );
  }

  const isMug = shape === 'mug';
  const bodyStyle = shape === 'shot'
    ? styles.cupBodySmall
    : shape === 'tumbler'
      ? styles.cupBodyLarge
      : styles.cupBody;
  const waterHeight = shape === 'shot' ? '42%' : shape === 'tumbler' ? '68%' : '55%';

  return (
    <View style={styles.cupIllustration}>
      {isMug ? <View style={styles.cupMugHandle} /> : null}
      <View style={bodyStyle}>
        <View style={[styles.cupWater, { height: waterHeight }]} />
      </View>
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backText: { color: palette.sage, fontSize: 13, fontWeight: '600' },
  eyebrow: { color: palette.sage, fontSize: 9, letterSpacing: 1.1, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 27, lineHeight: 34, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 6 },
  subtitle: { color: palette.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: spacing.md },
  progressCard: { alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.large, backgroundColor: palette.sagePale },
  progressRing: { width: 192, height: 192, position: 'relative', marginVertical: spacing.xs },
  progressDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', borderRadius: 88, backgroundColor: palette.surface, margin: 20 },
  ringIcon: { color: palette.sage, fontSize: 24, marginBottom: 4 },
  ringAmount: { color: palette.textPrimary, fontSize: 25, fontFamily: typography.fonts.display, fontWeight: '700' },
  ringGoal: { color: palette.textSecondary, fontSize: 10, marginTop: 3 },
  dateSelector: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  dateArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: palette.surface },
  dateArrowText: { color: palette.sage, fontSize: 22, lineHeight: 25 },
  disabledControl: { opacity: 0.4 },
  dateLabelWrap: { alignItems: 'center', gap: 3 },
  dateLabel: { color: palette.textPrimary, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  dateHint: { color: palette.textSecondary, fontSize: 9 },
  remainingText: { color: palette.textSecondary, fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: palette.textPrimary, fontSize: 16, fontFamily: typography.fonts.display, fontWeight: '600' },
  sectionSubtitle: { color: palette.textSecondary, fontSize: 10, marginTop: 3 },
  cupGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  cupButton: { width: '31%', minHeight: 91, alignItems: 'center', justifyContent: 'center', padding: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  cupButtonActive: { borderColor: palette.sage },
  cupIllustration: { width: 30, height: 29, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 5 },
  cupBody: { width: 21, height: 25, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', borderWidth: 1.5, borderColor: palette.sage, borderTopWidth: 2, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  cupBodySmall: { width: 17, height: 19, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', borderWidth: 1.5, borderColor: palette.sage, borderTopWidth: 2, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  cupBodyLarge: { width: 25, height: 28, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', borderWidth: 1.5, borderColor: palette.sage, borderTopWidth: 2, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  cupWater: { width: '100%', backgroundColor: palette.sageLight, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  cupMugHandle: { position: 'absolute', right: 0, top: 8, width: 8, height: 10, borderWidth: 1.5, borderColor: palette.sage, borderLeftWidth: 0, borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  cupBottleNeck: { width: 8, height: 5, borderWidth: 1.5, borderBottomWidth: 0, borderColor: palette.sage, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  cupBottleBody: { width: 18, height: 22, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', borderWidth: 1.5, borderColor: palette.sage, borderTopWidth: 0, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  cupAmount: { color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  cupLabel: { color: palette.textSecondary, fontSize: 8, marginTop: 2 },
  customAmountCard: { padding: spacing.md, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  customAmountCopy: { gap: 4 },
  customAmountTitle: { color: palette.textPrimary, fontSize: 12, fontWeight: '700' },
  customAmountHint: { color: palette.textSecondary, fontSize: 9, lineHeight: 14 },
  customAmountControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  customAmountInput: { flex: 1, minHeight: 42, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, color: palette.textPrimary, fontSize: 14 },
  customAmountUnit: { color: palette.textSecondary, fontSize: 11, fontWeight: '600' },
  customAmountButton: { minHeight: 42, minWidth: 88, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  customAmountButtonText: { color: palette.surface, fontSize: 10, fontWeight: '700' },
  guidanceNote: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: spacing.sm },
  undoText: { color: palette.sage, fontSize: 9, fontWeight: '600' },
  recordRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  recordIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.sagePale },
  recordIconText: { color: palette.sage, fontSize: 16 },
  recordCopy: { flex: 1, gap: 3 },
  recordTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '600' },
  recordSubtitle: { color: palette.textSecondary, fontSize: 9 },
  recordAmount: { color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  emptyCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  emptyTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  emptyText: { color: palette.textSecondary, fontSize: 9, marginTop: 4 },
  loader: { marginVertical: spacing.md },
  premiumSection: { marginTop: spacing.md },
  statsCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  statsTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: '700' },
  statsSubtitle: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: 4 },
  chart: { height: 160, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.xs, marginTop: spacing.md },
  chartDay: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  chartAmount: { height: 17, color: palette.textSecondary, fontSize: 7, textAlign: 'center' },
  chartTrack: { width: '75%', height: 110, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  chartBar: { width: '100%', borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  chartLabel: { color: palette.textSecondary, fontSize: 8, marginTop: 5, textTransform: 'capitalize' },
  chartDayNumber: { color: palette.textLight, fontSize: 7, marginTop: 2 },
  benefitsCard: { padding: spacing.md, marginTop: spacing.sm, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  wellnessIllustration: { height: 150, overflow: 'hidden', justifyContent: 'flex-end', padding: spacing.md, marginBottom: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale },
  illustrationSun: { position: 'absolute', top: 18, right: 35, width: 38, height: 38, borderRadius: 19, backgroundColor: palette.secondary },
  illustrationHillBack: { position: 'absolute', left: 52, bottom: 35, width: 170, height: 90, borderRadius: 80, backgroundColor: palette.sageLight, transform: [{ rotate: '-13deg' }] },
  illustrationHillFront: { position: 'absolute', left: -28, bottom: 13, width: 205, height: 75, borderRadius: 70, backgroundColor: palette.peach },
  illustrationWater: { position: 'absolute', right: -25, bottom: 0, width: 185, height: 62, overflow: 'hidden', borderTopLeftRadius: 90, backgroundColor: palette.sage },
  illustrationWave: { position: 'absolute', top: 13, left: 20, width: 150, height: 24, borderTopWidth: 2, borderColor: palette.surface, borderRadius: 30, opacity: 0.65 },
  illustrationDrop: { position: 'absolute', top: 31, right: 91, width: 25, height: 25, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 3, backgroundColor: palette.sage, transform: [{ rotate: '45deg' }] },
  illustrationDropShine: { position: 'absolute', top: 5, left: 6, width: 5, height: 9, borderRadius: 5, backgroundColor: palette.surface, opacity: 0.85 },
  illustrationCaption: { zIndex: 1, color: palette.textPrimary, fontSize: 10, fontFamily: typography.fonts.display, fontStyle: 'italic' },
  wellnessTitle: { color: palette.textPrimary, fontSize: 19, lineHeight: 25, fontFamily: typography.fonts.display, fontWeight: '700' },
  wellnessIntro: { color: palette.textSecondary, fontSize: 13, lineHeight: 21, marginTop: spacing.xs },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.border },
  benefitIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: palette.sagePale },
  benefitIconText: { color: palette.sage, fontSize: 18 },
  benefitCopy: { flex: 1, gap: 5 },
  benefitTitle: { color: palette.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  benefitDetail: { color: palette.textSecondary, fontSize: 13, lineHeight: 21 },
  disclaimer: { color: palette.textSecondary, fontSize: 11, lineHeight: 18, marginTop: spacing.md },
  premiumCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.sagePale, borderWidth: 1, borderColor: palette.border },
  premiumBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.extraLarge, backgroundColor: palette.surface },
  premiumBadgeText: { color: palette.sage, fontSize: 8, letterSpacing: 0.7, fontWeight: '700' },
  premiumTitle: { color: palette.textPrimary, fontSize: 14, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: spacing.sm },
  premiumText: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, marginTop: spacing.xs },
  premiumButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  premiumButtonText: { color: palette.surface, fontSize: 10, fontWeight: '700' },
  localNote: { color: palette.textLight, fontSize: 8, textAlign: 'center', marginTop: spacing.lg },
  errorText: { color: palette.error, fontSize: 10, marginTop: spacing.sm },
});
