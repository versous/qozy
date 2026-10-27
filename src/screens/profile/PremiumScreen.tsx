import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { CosyButton } from '../components/common/CosyButton';

interface PlanProps {
  name: string;
  price: string;
  features: string[];
  isPremium: boolean;
}

const PlanCard = ({ name, price, features, isPremium }: PlanProps) => (
  <View style={[styles.planCard, isPremium && styles.premiumCard]}>
    {isPremium && <View style={styles.premiumBadge}><Text style={styles.premiumBadgeText}>Recommandé</Text></View>}
    <Text style={styles.planName}>{name}</Text>
    <Text style={styles.planPrice}>{price}</Text>
    <View style={styles.featuresList}>
      {features.map((f, i) => (
        <Text key={i} style={styles.featureItem}>✨ {f}</Text>
      ))}
    </View>
    <CosyButton
      title={isPremium ? "Passer au Premium" : "Plan Actuel"}
      variant={isPremium ? 'primary' : 'outline'}
      onPress={() => {}}
    />
  </View>
);

const PremiumScreen = () => {
  const handlePayment = async (plan: string) => {
    Alert.alert(
      "Paiement Stripe",
      `Redirection vers le paiement pour le plan ${plan}...`,
      [{ text: "OK" }]
    );
    // Ici sera appelée la fonction stripe.ts
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContentStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Améliorez votre expérience</Text>
          <Text style={styles.subtitle}>Débloquez tout le potentiel de Qozy pour une vie plus sereine.</Text>
        </View>

        <View style={styles.plansContainer}>
          <PlanCard
            name="Gratuit"
            price="0€ / mois"
            features={['3 Habitudes max', 'Timer standard', 'Sons de base']}
            isPremium={false}
          />
          <PlanCard
            name="Premium"
            price="4.99€ / mois"
            features={['Habitudes illimitées', 'Sons Lofi exclusifs', 'Stats avancées', 'Zéro publicité']}
            isPremium={true}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Besoin d'aide ? Contactez notre équipe cosy.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  plansContainer: {
    gap: spacing.xl,
    alignItems: 'center',
  },
  planCard: {
    backgroundColor: colors.surface,
    width: '100%',
    padding: spacing.lg,
    borderRadius: borderRadius.large,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  premiumCard: {
    borderColor: colors.primary,
    borderWidth: 3,
    backgroundColor: '#FFFDFB',
  },
  premiumBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    position: 'absolute',
    top: -12,
  },
  premiumBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  planPrice: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  featuresList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  featureItem: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
});

export default PremiumScreen;
