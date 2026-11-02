import { typography } from '@/theme/typography';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { BottomNavigation } from '@/components/BottomNavigation';
import { BrandHeader } from '@/components/BrandHeader';
import { useHydration } from '@/hooks/useHydration';
import { usePremium } from '@/services/PremiumProvider';
import { borderRadius, spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

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

const WATER_CONTAINERS = [
  { name: 'Petit verre', amount: 150, icon: '🥃' },
  { name: 'Verre', amount: 250, icon: '🥛' },
  { name: 'Grand verre', amount: 350, icon: '🥤' },
  { name: 'Mug', amount: 300, icon: '☕' },
  { name: 'Gourde', amount: 500, icon: '🧴' },
  { name: 'Bouteille', amount: 750, icon: '🚰' },
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
  const [isAmountModalVisible, setIsAmountModalVisible] = useState(false);
  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState(String(hydration.dailyGoalMilliliters));
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const dateObject = new Date(`${hydration.selectedDate}T12:00:00`);
  const currentTotal = hydration.milliliters;
  const progress = Math.min(100, Math.round((currentTotal / hydration.dailyGoalMilliliters) * 100));
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

  const addWater = async (milliliters: number, container?: string): Promise<boolean> => {
    setIsAddingWater(true);
    try {
      await hydration.addWater(milliliters, container);
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
  const removeEntry = (entryId: string) => {
    void hydration.removeEntry(entryId).catch((reason: unknown) => {
      Alert.alert(
        'Suppression impossible',
        reason instanceof Error ? reason.message : 'Réessaie plus tard.'
      );
    });
  };
  const saveDailyGoal = async () => {
    const goal = Number(goalInput);
    if (!/^\d+$/.test(goalInput) || goal < 250 || goal > 10000) {
      Alert.alert('Repère à vérifier', 'Entre un repère compris entre 250 et 10 000 ml.');
      return;
    }
    setIsSavingGoal(true);
    try {
      await hydration.saveDailyGoal(goal);
      setIsGoalModalVisible(false);
    } catch (reason) {
      Alert.alert('Modification impossible', reason instanceof Error ? reason.message : 'Réessaie plus tard.');
    } finally {
      setIsSavingGoal(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BrandHeader />
        <View style={styles.titleRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jour précédent"
            disabled={!isPremium}
            onPress={() => changeDate(-1)}
            style={[styles.backButton, !isPremium && styles.disabledControl]}>
            <Text style={styles.backText}>‹  Aujourd’hui</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Une gorgée à la fois</Text>
        <View style={styles.dateSubtitleRow}>
          <Text style={styles.subtitle}>
            {formatDateLabel(hydration.selectedDate, hydration.today)} · Mon journal d’eau
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jour suivant"
            disabled={isToday}
            onPress={() => changeDate(1)}
            style={[styles.nextDateButton, isToday && styles.disabledControl]}>
            <Text style={styles.dateArrowText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.progressCard}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`Hydratation ${currentTotal} millilitres sur ${hydration.dailyGoalMilliliters} millilitres`}
            accessibilityValue={{ min: 0, max: 100, now: progress }}
            style={styles.progressRing}>
            <Svg width={176} height={176} viewBox="0 0 176 176" style={styles.progressSvg}>
              <Circle
                cx={88}
                cy={88}
                r={68}
                fill="none"
                stroke={colors.border}
                strokeWidth={7}
              />
              <Circle
                cx={88}
                cy={88}
                r={68}
                fill="none"
                stroke={colors.sage}
                strokeWidth={7}
                strokeLinecap="butt"
                strokeDasharray={`${2 * Math.PI * 68} ${2 * Math.PI * 68}`}
                strokeDashoffset={2 * Math.PI * 68 * (1 - progress / 100)}
                rotation={-90}
                origin="88, 88"
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringAmount}>{currentTotal.toLocaleString('fr-FR')} ml</Text>
              <Text style={styles.ringGoal}>sur {hydration.dailyGoalMilliliters.toLocaleString('fr-FR')} ml</Text>
            </View>
          </View>
          <Text style={styles.progressSummary}>
            {hydration.loading
              ? 'On prépare ton journal d’eau…'
              : `${progress} % de ton repère${remaining ? ` · encore ${remaining.toLocaleString('fr-FR')} ml` : ' · repère atteint'}`}
          </Text>
          <Text style={styles.progressHint}>Chaque petit verre compte.</Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Choisis ton contenant</Text>
            <Text style={styles.sectionSubtitle}>{currentTotal.toLocaleString('fr-FR')} ml au total</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter une prise d’eau"
            disabled={!isToday || hydration.loading || isAddingWater}
            onPress={() => {
              setCustomAmount('');
              setIsAmountModalVisible(true);
            }}
            style={[styles.addWaterButton, (!isToday || hydration.loading || isAddingWater) && styles.disabledControl]}>
            <Text style={styles.addWaterButtonText}>＋ Ajouter</Text>
          </Pressable>
        </View>
        <View style={styles.containerGrid}>
          {WATER_CONTAINERS.map((container) => (
            <Pressable
              key={container.name}
              accessibilityRole="button"
              accessibilityLabel={`Ajouter ${container.name}, ${container.amount} millilitres`}
              disabled={!isToday || hydration.loading || isAddingWater}
              onPress={() => void addWater(container.amount, container.name)}
              style={[
                styles.containerCard,
                (!isToday || hydration.loading || isAddingWater) && styles.disabledControl,
              ]}>
              <Text style={styles.containerIcon}>{container.icon}</Text>
              <Text style={styles.containerName}>{container.name}</Text>
              <Text style={styles.containerAmount}>{container.amount} ml</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.containerHint}>Ou ajoute une quantité personnalisée.</Text>
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Mes prises du jour</Text>
            <Text style={styles.sectionSubtitle}>Tu peux supprimer une prise enregistrée.</Text>
          </View>
        </View>
        {hydration.loading ? (
          <ActivityIndicator color={colors.sage} style={styles.loader} />
        ) : hydration.selectedEntries.length ? (
          [...hydration.selectedEntries].sort((a, b) => a.createdAt - b.createdAt).map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`Supprimer la prise de ${entry.milliliters} millilitres enregistrée à ${formatTime(entry.createdAt)}`}
              disabled={!isToday || isAddingWater}
              onPress={() => removeEntry(entry.id)}
              style={[styles.recordRow, (!isToday || isAddingWater) && styles.disabledControl]}>
              <View style={styles.recordIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path d="M12 3.5S6.5 10 6.5 14.5a5.5 5.5 0 0 0 11 0C17.5 10 12 3.5 12 3.5Z" fill="none" stroke={colors.sage} strokeWidth={1.8} />
                </Svg>
              </View>
              <Text style={styles.recordTime}>{formatTime(entry.createdAt)} · {entry.container ?? 'Eau'}</Text>
              <Text style={styles.recordAmount}>{entry.milliliters} ml</Text>
              <Text style={styles.recordUndo}>↶</Text>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aucun verre enregistré pour le moment.</Text>
            <Text style={styles.emptyText}>Ajoute une gorgée quand tu en as envie.</Text>
          </View>
        )}
        {hydration.error ? <Text style={styles.errorText}>{hydration.error}</Text> : null}

        <View style={styles.goalCard}>
          <View style={styles.goalIcon}>
            <Text style={styles.goalIconText}>☷</Text>
          </View>
          <View style={styles.goalCopy}>
            <Text style={styles.goalTitle}>Mon objectif quotidien</Text>
            <Text style={styles.goalSubtitle}>
              {hydration.goalLoading
                ? 'Chargement de ton repère…'
                : `${hydration.dailyGoalMilliliters.toLocaleString('fr-FR')} ml · Personnalisable`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={hydration.goalLoading}
            onPress={() => {
              setGoalInput(String(hydration.dailyGoalMilliliters));
              setIsGoalModalVisible(true);
            }}
            style={[styles.goalEditButton, hydration.goalLoading && styles.disabledControl]}>
            <Text style={styles.goalEditText}>{hydration.goalLoading ? '…' : 'Modifier'}</Text>
          </Pressable>
        </View>
        <Text style={styles.guidanceNote}>
          Ce repère est indicatif, pas un objectif médical. Tes besoins peuvent varier.
        </Text>

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

      <Modal
        visible={isAmountModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAmountModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalEyebrow}>MON JOURNAL D’EAU</Text>
            <Text style={styles.modalTitle}>Ajouter un verre</Text>
            <Text style={styles.modalDescription}>Indique la quantité bue, entre 50 et 5 000 ml.</Text>
            <View style={styles.customAmountControls}>
              <TextInput
                accessibilityLabel="Quantité d’eau en millilitres"
                value={customAmount}
                onChangeText={(value) => setCustomAmount(value.replace(/[^\d]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                returnKeyType="done"
                placeholder="Ex. 250"
                placeholderTextColor={colors.textLight}
                maxLength={4}
                style={styles.customAmountInput}
              />
              <Text style={styles.customAmountUnit}>ml</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={!customAmount || isAddingWater}
              onPress={() => {
                const amount = Number(customAmount);
                if (!/^\d+$/.test(customAmount) || amount < 50 || amount > 5000) {
                  Alert.alert('Quantité à vérifier', 'Entre une quantité comprise entre 50 et 5 000 ml.');
                  return;
                }
                void addWater(amount).then((saved) => {
                  if (saved) {
                    setCustomAmount('');
                    setIsAmountModalVisible(false);
                  }
                });
              }}
              style={[styles.modalPrimaryButton, (!customAmount || isAddingWater) && styles.disabledControl]}>
              {isAddingWater
                ? <ActivityIndicator color={colors.surface} />
                : <Text style={styles.modalPrimaryButtonText}>Ajouter à mon journal</Text>}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsAmountModalVisible(false)}
              style={styles.modalCancelButton}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isGoalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsGoalModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalEyebrow}>À TON RYTHME</Text>
            <Text style={styles.modalTitle}>Mon repère quotidien</Text>
            <Text style={styles.modalDescription}>
              Personnalise ton repère d’hydratation. Il reste indicatif et n’est pas un conseil médical.
            </Text>
            <View style={styles.customAmountControls}>
              <TextInput
                accessibilityLabel="Objectif quotidien en millilitres"
                value={goalInput}
                onChangeText={(value) => setGoalInput(value.replace(/[^\d]/g, '').slice(0, 5))}
                keyboardType="number-pad"
                returnKeyType="done"
                placeholder="Ex. 2000"
                placeholderTextColor={colors.textLight}
                maxLength={5}
                style={styles.customAmountInput}
              />
              <Text style={styles.customAmountUnit}>ml / jour</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={isSavingGoal || !goalInput}
              onPress={() => void saveDailyGoal()}
              style={[styles.modalPrimaryButton, (isSavingGoal || !goalInput) && styles.disabledControl]}>
              {isSavingGoal
                ? <ActivityIndicator color={colors.surface} />
                : <Text style={styles.modalPrimaryButtonText}>Enregistrer mon repère</Text>}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsGoalModalVisible(false)}
              style={styles.modalCancelButton}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.xs },
  backText: { color: palette.sage, fontSize: 10, fontWeight: '600' },
  eyebrow: { color: palette.sage, fontSize: 8, letterSpacing: 1.1, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 25, lineHeight: 32, fontFamily: typography.fonts.display, fontWeight: '600', marginTop: 3 },
  dateSubtitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  subtitle: { flex: 1, color: palette.textSecondary, fontSize: 10, lineHeight: 16, marginTop: 2 },
  nextDateButton: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  progressCard: { alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: borderRadius.large, backgroundColor: palette.sagePale },
  progressRing: { width: 176, height: 176, position: 'relative' },
  progressSvg: { position: 'absolute', left: 0, top: 0 },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringAmount: { color: palette.textPrimary, fontSize: 25, fontFamily: typography.fonts.display, fontWeight: '600' },
  ringGoal: { color: palette.textSecondary, fontSize: 9, marginTop: 3 },
  progressSummary: { color: palette.sage, fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: spacing.xs },
  progressHint: { color: palette.textSecondary, fontSize: 8, marginTop: spacing.xs },
  dateArrowText: { color: palette.sage, fontSize: 22, lineHeight: 25 },
  disabledControl: { opacity: 0.4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  sectionTitle: { color: palette.textPrimary, fontSize: 15, fontFamily: typography.fonts.display, fontWeight: '600' },
  sectionSubtitle: { color: palette.textSecondary, fontSize: 8, marginTop: 2 },
  addWaterButton: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sagePale },
  addWaterButtonText: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  containerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'space-between' },
  containerCard: { width: '31.5%', minHeight: 82, alignItems: 'center', justifyContent: 'center', padding: spacing.xs, marginBottom: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  containerIcon: { fontSize: 22, marginBottom: 3 },
  containerName: { color: palette.textPrimary, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  containerAmount: { color: palette.sage, fontSize: 8, marginTop: 2 },
  containerHint: { color: palette.textSecondary, fontSize: 8, textAlign: 'center', marginTop: spacing.xs },
  recordRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.xs, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  recordIcon: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center' },
  recordTime: { flex: 1, color: palette.textSecondary, fontSize: 9 },
  recordAmount: { color: palette.textPrimary, fontSize: 9, fontWeight: '700' },
  recordUndo: { color: palette.textSecondary, fontSize: 17, marginLeft: spacing.xs },
  emptyCard: { padding: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  emptyTitle: { color: palette.textPrimary, fontSize: 11, fontWeight: '700' },
  emptyText: { color: palette.textSecondary, fontSize: 9, marginTop: 4 },
  loader: { marginVertical: spacing.md },
  goalCard: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.md, borderRadius: borderRadius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  goalIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: palette.sagePale },
  goalIconText: { color: palette.sage, fontSize: 16 },
  goalCopy: { flex: 1 },
  goalTitle: { color: palette.textPrimary, fontSize: 9, fontWeight: '700' },
  goalSubtitle: { color: palette.textSecondary, fontSize: 8, marginTop: 3 },
  goalEditButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  goalEditText: { color: palette.sage, fontSize: 8, fontWeight: '700' },
  guidanceNote: { color: palette.textSecondary, fontSize: 8, lineHeight: 12, marginTop: spacing.xs },
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
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(42, 48, 39, 0.38)' },
  modal: { padding: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: borderRadius.large, borderTopRightRadius: borderRadius.large, backgroundColor: palette.background },
  modalEyebrow: { color: palette.sage, fontSize: 8, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center' },
  modalTitle: { color: palette.textPrimary, fontSize: 20, fontFamily: typography.fonts.display, fontWeight: '600', textAlign: 'center', marginTop: spacing.xs },
  modalDescription: { color: palette.textSecondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: spacing.xs },
  customAmountControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  customAmountInput: { flex: 1, minHeight: 46, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: borderRadius.small, backgroundColor: palette.surface, color: palette.textPrimary, fontSize: 15 },
  customAmountUnit: { color: palette.textSecondary, fontSize: 10, fontWeight: '600' },
  modalPrimaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, borderRadius: borderRadius.extraLarge, backgroundColor: palette.sage },
  modalPrimaryButtonText: { color: palette.surface, fontSize: 9, fontWeight: '700' },
  modalCancelButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  modalCancelText: { color: palette.textSecondary, fontSize: 9, fontWeight: '600' },
});
