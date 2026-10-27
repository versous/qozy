import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { CosyButton } from '../components/common/CosyButton';
import { auth } from '../../services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        alert('Connexion réussie ! ✨');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Compte créé avec succès ! 🌱');
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Qozy</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Heureux de vous revoir !' : 'Commencez votre voyage cosy'}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <CosyButton
            title={isLogin ? 'Se connecter' : 'S\'inscrire'}
            onPress={handleAuth}
            style={styles.mainButton}
          />

          <CosyButton
            title={isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
            variant="outline"
            onPress={() => setIsLogin(!isLogin)}
            style={styles.switchButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  mainButton: {
    marginTop: spacing.md,
    height: 55,
  },
  switchButton: {
    marginTop: spacing.md,
    backgroundColor: 'transparent',
  },
});

export default AuthScreen;
