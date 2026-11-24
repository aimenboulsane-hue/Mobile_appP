import { useState } from 'react';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import { Notice } from '@/components/States';
import { api, errorMessage } from '@/lib/api';
import type { ClientRow } from '@/lib/types';

import { CrudSection, type FormProps } from './CrudSection';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ClientsSection({ header }: { header: React.ReactNode }) {
  return (
    <CrudSection<ClientRow>
      header={header}
      fetcher={async () => (await api.get<{ clients: ClientRow[] }>('/admin/clients')).clients}
      keyOf={(client) => client.id}
      addLabel="Ajouter"
      countLabel={(n) => `${n} client${n > 1 ? 's' : ''}`}
      empty={{ icon: 'people-outline', title: 'Aucun client', message: 'Les clients inscrits apparaîtront ici.' }}
      renderRow={(client) => ({
        title: client.name,
        lines: [
          client.email,
          `${client.reservations_count} réservation${client.reservations_count > 1 ? 's' : ''}`
            + (client.phone ? ` · ${client.phone}` : ''),
        ],
        badges: client.has_subscription ? <Badge label="Abonné" tone="primary" icon="star" /> : undefined,
      })}
      deletePath={(client) => `/admin/clients/${client.id}`}
      deleteTitle="Supprimer ce client ?"
      deleteMessage={(client) =>
        `Le compte de ${client.name}, ses réservations, ses paiements et ses abonnements seront supprimés définitivement.`}
      deletedMessage="Client supprimé."
      Form={ClientForm}
    />
  );
}

type Errors = { name?: string; email?: string; password?: string };

function ClientForm({ item, onClose, onSaved }: FormProps<ClientRow>) {
  const [name, setName] = useState(item?.name ?? '');
  const [email, setEmail] = useState(item?.email ?? '');
  const [phone, setPhone] = useState(item?.phone ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const found: Errors = {};
    if (name.trim().length < 2) found.name = 'Le nom doit contenir au moins 2 caractères.';
    if (!EMAIL_RE.test(email.trim())) found.email = 'Adresse e-mail invalide.';
    if ((!item || password) && password.length < 8) found.password = 'Au moins 8 caractères.';
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const body = { name: name.trim(), email: email.trim(), phone: phone.trim(), password };
      if (item) await api.put(`/admin/clients/${item.id}`, body);
      else await api.post('/admin/clients', body);
      onSaved(item ? 'Client modifié.' : 'Client ajouté.');
    } catch (e) {
      setServerError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Sheet visible title={item ? 'Modifier le client' : 'Nouveau client'} onClose={onClose}
      footer={<Button title="Enregistrer" onPress={save} loading={saving} />}>
      <Input label="Nom complet" icon="person-outline" placeholder="Prénom et nom" value={name}
        onChangeText={setName} error={errors.name} autoCapitalize="words" editable={!saving} />
      <Input label="E-mail" icon="mail-outline" placeholder="client@exemple.com" value={email}
        onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none"
        editable={!saving} />
      <Input label="Téléphone (facultatif)" icon="call-outline" placeholder="0661 23 45 67" value={phone}
        onChangeText={setPhone} keyboardType="phone-pad" editable={!saving} />
      <Input label={item ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe'} icon="lock-closed-outline"
        placeholder="Au moins 8 caractères" value={password} onChangeText={setPassword}
        error={errors.password} password editable={!saving}
        hint={item ? 'Laissez vide pour conserver le mot de passe actuel.' : undefined} />
      {serverError && <Notice message={serverError} />}
    </Sheet>
  );
}
