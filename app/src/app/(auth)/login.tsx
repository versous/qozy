import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, borderRadius, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { BrandHeader } from '@/components/BrandHeader';
import { CosyButton } from '@/components/common/CosyButton';
import { auth, isFirebaseConfigured } from '@/services/firebase';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { router } from 'expo-router';

const AuthScreen = () => {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [noticeMessage, setNoticeMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const passwordInput = React.useRef<TextInput>(null);
  const confirmPasswordInput = React.useRef<TextInput>(null);

  const handlePasswordReset = async () => {
    if (!auth || !isFirebaseConfigured) {
      setErrorMessage('Configurez Firebase dans le fichier .env pour continuer.');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Saisis ton adresse e-mail pour recevoir le lien de réinitialisation.');
      return;
    }

    setErrorMessage('');
    setNoticeMessage('');
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setNoticeMessage('Si un compte correspond à cette adresse, un lien de réinitialisation vient d’être envoyé.');
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'auth/invalid-email') {
        setErrorMessage('Saisis une adresse e-mail valide.');
      } else if (error instanceof FirebaseError && error.code === 'auth/network-request-failed') {
        setErrorMessage('Connexion réseau impossible. Réessaie.');
      } else {
        setErrorMessage('Impossible d’envoyer le lien pour le moment. Réessaie.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!auth || !isFirebaseConfigured) {
      setErrorMessage('Configurez Firebase dans le fichier .env pour vous connecter.');
      return;
    }

    setErrorMessage('');
    setNoticeMessage('');
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <BrandHeader />
            <Text style={styles.title}>
              {isRegistering ? 'Créer votre compte' : 'Ravi de te retrouver'}
            </Text>
            <Text style={styles.subtitle}>Ton espace de sérénité et de productivité.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adresse e-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="exemple@mail.com"
                placeholderTextColor={colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordInput.current?.focus()}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Mot de passe</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPasswordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onPress={() => setIsPasswordVisible((visible) => !visible)}
                  hitSlop={8}>
                  <Text style={styles.visibilityToggle}>{isPasswordVisible ? 'Masquer' : 'Afficher'}</Text>
                </Pressable>
              </View>
              <TextInput
                ref={passwordInput}
                style={styles.input}
                placeholder="Saisis ton mot de passe"
                placeholderTextColor={colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                returnKeyType={isRegistering ? 'next' : 'done'}
                onSubmitEditing={() => {
                  if (isRegistering) confirmPasswordInput.current?.focus();
                  else void handleSubmit();
                }}
              />
            </View>

            {!isRegistering ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void handlePasswordReset()}
                disabled={isSubmitting}
                style={styles.forgotPassword}>
                <Text style={styles.visibilityToggle}>Mot de passe oublié ?</Text>
              </Pressable>
            ) : null}

            {isRegistering ? (
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Confirmer le mot de passe</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isConfirmPasswordVisible ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                    onPress={() => setIsConfirmPasswordVisible((visible) => !visible)}
                    hitSlop={8}>
                    <Text style={styles.visibilityToggle}>{isConfirmPasswordVisible ? 'Masquer' : 'Afficher'}</Text>
                  </Pressable>
                </View>
                <TextInput
                  ref={confirmPasswordInput}
                  style={styles.input}
                  placeholder="Saisis à nouveau ton mot de passe"
                  placeholderTextColor={colors.textLight}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!isConfirmPasswordVisible}
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmit()}
                />
              </View>
            ) : null}

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            {noticeMessage ? <Text style={styles.notice}>{noticeMessage}</Text> : null}
            <CosyButton
              title={
                isSubmitting
                  ? (isRegistering ? 'Création…' : 'Connexion…')
                  : (isRegistering ? 'Créer mon compte' : 'Se connecter')
              }
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={styles.loginButton}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsRegistering((current) => !current);
                setErrorMessage('');
                setNoticeMessage('');
                setIsPasswordVisible(false);
                setIsConfirmPasswordVisible(false);
              }}
              style={styles.switchMode}>
              <Text style={styles.switchModeText}>
                {isRegistering
                  ? 'Déjà un compte ? Se connecter'
                  : 'Pas encore de compte ? S’inscrire'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brand: {
    color: palette.textPrimary,
    fontSize: 44,
    lineHeight: 52,
    fontFamily: typography.fonts.display,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: palette.textPrimary,
    textAlign: 'center',
    fontFamily: typography.fonts.display,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: palette.textPrimary,
  },
  visibilityToggle: {
    color: palette.sage,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  input: {
    minHeight: 54,
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    fontSize: typography.sizes.md,
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  loginButton: {
    marginTop: spacing.md,
    height: 55,
  },
  error: {
    color: palette.error,
    textAlign: 'center',
    fontSize: typography.sizes.sm,
  },
  notice: {
    color: palette.sage,
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  switchMode: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  switchModeText: {
    color: palette.primary,
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
});

export default AuthScreen;
