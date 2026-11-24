import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/components/Brand';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Notice } from '@/components/States';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const found: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) found.email = 'Adresse e-mail invalide.';
    if (!password) found.password = 'Saisissez votre mot de passe.';
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setServerError(errorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.center}>
        <Brand tagline="Le stationnement intelligent, au meilleur prix." />
        <Card>
          <Text style={styles.title}>Connexion</Text>
          <Input label="E-mail" icon="mail-outline" placeholder="vous@exemple.com" value={email}
            onChangeText={setEmail} error={errors.email} keyboardType="email-address"
            autoCapitalize="none" autoComplete="email" editable={!submitting} returnKeyType="next" />
          <Input label="Mot de passe" icon="lock-closed-outline" placeholder="Votre mot de passe"
            value={password} onChangeText={setPassword} error={errors.password} password
            editable={!submitting} returnKeyType="done" onSubmitEditing={submit} />
          {serverError && <Notice message={serverError} />}
          <Button title="Se connecter" onPress={submit} loading={submitting} />
        </Card>
        <View style={styles.switch}>
          <Text style={styles.switchText}>Pas encore de compte ?</Text>
          <Link href="/register" style={styles.link}>Créer un compte</Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg, width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  switch: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  switchText: { fontSize: fontSize.sm, color: colors.textSecondary },
  link: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
});
