import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { CosyButton } from '@/components/common/CosyButton';
import { auth, isFirebaseConfigured } from '@/services/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { router } from 'expo-router';

const AuthScreen = () => {
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!auth || !isFirebaseConfigured) {
      setErrorMessage('Configurez Firebase dans le fichier .env pour vous connecter.');
      return;
    }

    setErrorMessage('');
    if (isRegistering && password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    if (isRegistering && password.length < 6) {
      setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace('/');
    } catch (error) {
      if (error instanceof FirebaseError) {
        const messages: Record<string, string> = {
          'auth/email-already-in-use': 'Cette adresse e-mail possède déjà un compte.',
          'auth/invalid-email': 'Saisissez une adresse e-mail valide.',
          'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
          'auth/weak-password': 'Choisissez un mot de passe plus sécurisé.',
          'auth/operation-not-allowed': 'Activez e-mail/mot de passe dans Firebase Authentication.',
          'auth/network-request-failed': 'Connexion réseau impossible. Réessayez.',
        };
        setErrorMessage(messages[error.code] ?? 'Une erreur est survenue. Réessayez.');
      } else {
        setErrorMessage('Une erreur est survenue. Réessayez.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {isRegistering ? 'Créer votre compte Qozy ✨' : 'Bienvenue chez Qozy ✨'}
          </Text>
          <Text style={styles.subtitle}>Votre espace de sérénité et de productivité</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="exemple@mail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
            />
          </View>

          {isRegistering ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
          ) : null}

          <CosyButton
            title={
              isSubmitting
                ? (isRegistering ? 'Création...' : 'Connexion...')
                : (isRegistering ? 'Créer mon compte' : 'Se connecter')
            }
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={styles.loginButton}
          />
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          <Text
            accessibilityRole="button"
            onPress={() => {
              setIsRegistering((current) => !current);
              setErrorMessage('');
            }}
            style={styles.switchMode}
          >
            {isRegistering
              ? 'Déjà un compte ? Se connecter'
              : 'Pas encore de compte ? S’inscrire'}
          </Text>
        </View>
      </View>
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
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
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
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.textPrimary,
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
  loginButton: {
    marginTop: spacing.md,
    height: 55,
  },
  error: {
    color: colors.error,
    textAlign: 'center',
    fontSize: typography.sizes.sm,
  },
  switchMode: {
    color: colors.primary,
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
});

export default AuthScreen;
