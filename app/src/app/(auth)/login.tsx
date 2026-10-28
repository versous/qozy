import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { colors, spacing, borderRadius } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { CosyButton } from '@/src/components/common/CosyButton';
import { auth } from '@/src/services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { router } from 'expo-router';

const AuthScreen = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/');
    } catch (error) {
      alert('Erreur de connexion : ' + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Bienvenue chez Qozy ✨</Text>
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
            />
          </View>

          <CosyButton
            title="Se connecter"
            onPress={handleLogin}
            style={styles.loginButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

// Note: J'ajoute TextInput ici car il manquait dans l'import
import { TextInput } from 'react-native';

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
});

export default AuthScreen;
