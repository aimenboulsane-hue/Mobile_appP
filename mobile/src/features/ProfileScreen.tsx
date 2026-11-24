import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/Input';
import { DataScreen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoRow, SectionTitle } from '@/components/Section';
import { Notice } from '@/components/States';
import { useToast } from '@/components/Toast';
import { API_URL } from '@/config';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateLong, initials } from '@/lib/format';
import type { User } from '@/lib/types';
import { useFetch } from '@/lib/useFetch';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function ProfileScreen() {
  const { role, logout, updateUser } = useAuth();
  const toast = useToast();
  const state = useFetch<User>(async () => (await api.get<{ user: User }>('/auth/me')).user);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const startEditing = (user: User) => {
    setName(user.name);
    setPhone(user.phone);
    setNameError(null);
    setServerError(null);
    setEditing(true);
  };

  const save = async () => {
    if (saving) return;
    if (name.trim().length < 2) {
      setNameError('Le nom doit contenir au moins 2 caractères.');
      return;
    }
    setNameError(null);
    setServerError(null);
    setSaving(true);
    try {
      const { user } = await api.put<{ user: User }>('/auth/me', { name: name.trim(), phone: phone.trim() });
      state.setData(user);
      updateUser(user);
      setEditing(false);
      toast('Profil mis à jour.');
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DataScreen state={state} header={<ScreenHeader title="Profil" />}>
        {(user) => (
          <>
            <Card>
              <View style={styles.identity}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(user.name)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
                  <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
                </View>
                <View><Badge label={role === 'admin' ? 'Administrateur' : 'Client'} tone="primary" /></View>
              </View>
            </Card>

            <SectionTitle title="Mes informations" />
            {editing ? (
              <Card>
                <Input label="Nom complet" icon="person-outline" value={name} onChangeText={setName}
                  error={nameError} autoCapitalize="words" editable={!saving} />
                <Input label="Téléphone" icon="call-outline" value={phone} onChangeText={setPhone}
                  keyboardType="phone-pad" placeholder="0661 23 45 67" editable={!saving} />
                {serverError && <Notice message={serverError} />}
                <View style={styles.actions}>
                  <Button title="Annuler" variant="secondary" onPress={() => setEditing(false)}
                    disabled={saving} style={styles.flex} />
                  <Button title="Enregistrer" onPress={save} loading={saving} style={styles.flex} />
                </View>
              </Card>
            ) : (
              <Card>
                <InfoRow label="Nom" value={user.name} />
                <InfoRow label="E-mail" value={user.email} />
                <InfoRow label="Téléphone" value={user.phone || 'Non renseigné'} />
                <InfoRow label="Membre depuis" value={formatDateLong(user.created_at)} />
                <Button title="Modifier" variant="secondary" icon="create-outline" onPress={() => startEditing(user)} />
              </Card>
            )}

            <SectionTitle title="Application" />
            <Card>
              <InfoRow label="Serveur" value={API_URL} />
              <InfoRow label="Version" value="1.0.0" />
            </Card>

            <Button title="Se déconnecter" variant="danger" icon="log-out-outline"
              onPress={() => setConfirmLogout(true)} />
          </>
        )}
      </DataScreen>

      <ConfirmDialog
        visible={confirmLogout}
        title="Se déconnecter ?"
        message="Vous devrez saisir vos identifiants pour vous reconnecter."
        confirmLabel="Se déconnecter"
        cancelLabel="Annuler"
        destructive
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.onPrimary },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  email: { fontSize: fontSize.sm, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.md },
});
