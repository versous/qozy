import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { colors, spacing, borderRadius } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { CosyButton } from '@/src/components/common/CosyButton';
import { router } from 'expo-router';

const PremiumScreen = () => {
  const plans = [
    {
      id: 'basic',
      name: 'Cosy Basic',
      price: 'Gratuit',
      features: ['Habitudes illimitées', 'Pomodoro standard', 'Accès communautaire'],
      recommended: false,
    },
    {
      id: 'premium',
      name: 'Cosy Premium',
      price: '4.99€ / mois',
      features: ['Tout du Basic', 'Statistiques avancées', 'Thèmes personnalisés', 'Zéro publicité'],
      recommended: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Passez au Premium ✨</Text>
          <Text style={styles.subtitle}>Débloquez tout le potentiel de votre esprit cosy</Text>
        </View>

        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <View key={plan.id} style={[styles.planCard, plan.recommended && styles.recommendedCard]}>
              {plan.recommended && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>RECOMMANDÉ</Text>
                </View>
              )}
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>

              <View style={styles.featuresList}>
                {plan.features.map((feature, index) => (
                  <Text key={index} style={styles.featureItem}>
                    ✅ {feature}
                  </Text>
                ))}
              </View>

              <CosyButton
                title={plan.id === 'premium' ? 'S'abonner' : 'Plan actuel'}
                variant={plan.recommended ? 'primary' : 'outline'}
                onPress={() => {}}
                style={styles.planButton}
              />
            </View>
          ))}
        </View>

        <CosyButton
          title="Retour au Dashboard"
          variant="outline"
          onPress={() => router.replace('/')}
          style={styles.backButton}
        />
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
    alignItems: 'center',
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
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  plansContainer: {
    width: '100%',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  planCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.large,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  recommendedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(145, 100, 200, 0.05)',
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  planPrice: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginVertical: 8,
  },
  featuresList: {
    marginVertical: spacing.md,
    gap: 8,
    width: '100%',
  },
  featureItem: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  planButton: {
    width: '100%',
    marginTop: spacing.md,
  },
  backButton: {
    width: '100%',
    marginTop: spacing.lg,
  },
});

export default PremiumScreen;
