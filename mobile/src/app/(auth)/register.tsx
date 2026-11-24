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

type Errors = { name?: string; email?: string; password?: string; confirm?: string };

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const found: Errors = {};
    if (name.trim().length < 2) found.name = 'Le nom doit contenir au moins 2 caractères.';
    if (!EMAIL_RE.test(email.trim())) found.email = 'Adresse e-mail invalide.';
    if (password.length < 8) found.password = 'Au moins 8 caractères.';
    if (confirm !== password) found.confirm = 'Les mots de passe ne correspondent pas.';
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
    } catch (e) {
      setServerError(errorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.center}>
        <Brand tagline="Créez votre compte pour réserver une place en quelques secondes." />
        <Card>
          <Text style={styles.title}>Inscription</Text>
          <Input label="Nom complet" icon="person-outline" placeholder="Prénom et nom" value={name}
            onChangeText={setName} error={errors.name} autoCapitalize="words" editable={!submitting} />
          <Input label="E-mail" icon="mail-outline" placeholder="vous@exemple.com" value={email}
            onChangeText={setEmail} error={errors.email} keyboardType="email-address"
            autoCapitalize="none" autoComplete="email" editable={!submitting} />
          <Input label="Téléphone (facultatif)" icon="call-outline" placeholder="0661 23 45 67"
            value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!submitting} />
          <Input label="Mot de passe" icon="lock-closed-outline" placeholder="Au moins 8 caractères"
            value={password} onChangeText={setPassword} error={errors.password} password
            editable={!submitting} />
          <Input label="Confirmer le mot de passe" icon="lock-closed-outline"
            placeholder="Répétez le mot de passe" value={confirm} onChangeText={setConfirm}
            error={errors.confirm} password editable={!submitting} onSubmitEditing={submit} />
          {serverError && <Notice message={serverError} />}
          <Button title="Créer mon compte" onPress={submit} loading={submitting} />
        </Card>
        <View style={styles.switch}>
          <Text style={styles.switchText}>Déjà inscrit ?</Text>
          <Link href="/login" replace style={styles.link}>Se connecter</Link>
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
