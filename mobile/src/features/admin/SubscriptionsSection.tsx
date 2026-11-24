import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/Choices';
import { SelectField } from '@/components/SelectField';
import { Sheet } from '@/components/Sheet';
import { ErrorState, LoadingState, Notice } from '@/components/States';
import { api, errorMessage } from '@/lib/api';
import { formatDateNumeric, formatPrice } from '@/lib/format';
import { subscriptionLabels } from '@/lib/labels';
import type { ClientRow, Plan, Subscription } from '@/lib/types';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

import { CrudSection, type FormProps } from './CrudSection';

export function SubscriptionsSection({ header }: { header: React.ReactNode }) {
  return (
    <CrudSection<Subscription>
      header={header}
      fetcher={async () =>
        (await api.get<{ subscriptions: Subscription[] }>('/admin/subscriptions')).subscriptions}
      keyOf={(sub) => sub.id}
      addLabel="Ajouter"
      countLabel={(n) => `${n} abonnement${n > 1 ? 's' : ''}`}
      empty={{ icon: 'card-outline', title: 'Aucun abonnement', message: 'Les abonnements des clients apparaîtront ici.' }}
      renderRow={(sub) => ({
        title: sub.user_name ?? 'Client supprimé',
        lines: [
          `Formule ${sub.plan_name.toLowerCase()} · ${formatPrice(sub.price)}`,
          `Du ${formatDateNumeric(sub.start_date)} au ${formatDateNumeric(sub.end_date)}`,
        ],
        badges: <Badge {...subscriptionLabels[sub.state]} />,
      })}
      deletePath={(sub) => `/admin/subscriptions/${sub.id}`}
      deleteTitle="Supprimer cet abonnement ?"
      deleteMessage={(sub) =>
        `L'abonnement de ${sub.user_name ?? 'ce client'} et son paiement seront supprimés définitivement.`}
      deletedMessage="Abonnement supprimé."
      Form={SubscriptionForm}
    />
  );
}

type Options = { clients: ClientRow[]; plans: Plan[] };

function SubscriptionForm({ item, onClose, onSaved }: FormProps<Subscription>) {
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [clients, plans] = await Promise.all([
        api.get<{ clients: ClientRow[] }>('/admin/clients'),
        api.get<{ plans: Plan[] }>('/plans'),
      ]);
      setOptions({ clients: clients.clients, plans: plans.plans });
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const [clientId, setClientId] = useState<number | null>(item?.user_id ?? null);
  const [planId, setPlanId] = useState<number | null>(item?.plan_id ?? null);
  const [status, setStatus] = useState<Subscription['status']>(item?.status ?? 'active');
  const [errors, setErrors] = useState<{ client?: string; plan?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const found: typeof errors = {};
    if (!clientId) found.client = 'Choisissez un client.';
    if (!planId) found.plan = 'Choisissez une formule.';
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      if (item) await api.put(`/admin/subscriptions/${item.id}`, { plan_id: planId, status });
      else await api.post('/admin/subscriptions', { user_id: clientId, plan_id: planId });
      onSaved(item ? 'Abonnement modifié.' : 'Abonnement ajouté.');
    } catch (e) {
      setServerError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Sheet visible title={item ? "Modifier l'abonnement" : 'Nouvel abonnement'} onClose={onClose}
      footer={options && <Button title="Enregistrer" onPress={save} loading={saving} />}>
      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : !options ? (
        <LoadingState />
      ) : (
        <>
          {item ? (
            <Notice tone="primary" message={`Client : ${item.user_name ?? 'supprimé'}`} />
          ) : (
            <SelectField
              label="Client"
              placeholder="Choisir un client"
              value={clientId}
              onChange={setClientId}
              error={errors.client}
              options={options.clients.map((c) => ({
                value: c.id, label: c.name, sublabel: c.has_subscription ? 'Déjà abonné' : c.email,
              }))}
            />
          )}
          <SelectField
            label="Formule"
            placeholder="Choisir une formule"
            value={planId}
            onChange={setPlanId}
            error={errors.plan}
            options={options.plans.map((p) => ({
              value: p.id, label: p.name, sublabel: `${p.duration_days} jours · ${formatPrice(p.price)}`,
            }))}
          />
          {item ? (
            <View style={styles.group}>
              <Text style={styles.label}>Statut</Text>
              <SegmentedControl
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'active', label: 'Actif' },
                  { value: 'cancelled', label: 'Annulé' },
                ]}
              />
            </View>
          ) : (
            <Notice tone="primary"
              message="La date de fin est calculée à partir de la formule. Paiement enregistré en espèces." />
          )}
          {serverError && <Notice message={serverError} />}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
});
