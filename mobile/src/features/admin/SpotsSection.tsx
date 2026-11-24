import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/Choices';
import { Input } from '@/components/Input';
import { Sheet } from '@/components/Sheet';
import { Notice } from '@/components/States';
import { api, errorMessage } from '@/lib/api';
import { spotLabels } from '@/lib/labels';
import type { Spot } from '@/lib/types';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

import { CrudSection, type FormProps } from './CrudSection';

export function SpotsSection({ header }: { header: React.ReactNode }) {
  return (
    <CrudSection<Spot>
      header={header}
      fetcher={async () => (await api.get<{ spots: Spot[] }>('/admin/spots')).spots}
      keyOf={(spot) => spot.id}
      addLabel="Ajouter"
      countLabel={(n) => `${n} place${n > 1 ? 's' : ''}`}
      empty={{ icon: 'car-outline', title: 'Aucune place', message: 'Ajoutez la première place du parking.' }}
      renderRow={(spot) => ({
        title: `Place ${spot.number}`,
        lines: [spot.zone],
        badges: <Badge {...spotLabels[spot.status]} />,
      })}
      deletePath={(spot) => `/admin/spots/${spot.id}`}
      deleteTitle="Supprimer cette place ?"
      deleteMessage={(spot) => `La place ${spot.number} sera retirée du parking. Cette action est définitive.`}
      deletedMessage="Place supprimée."
      Form={SpotForm}
    />
  );
}

function SpotForm({ item, onClose, onSaved }: FormProps<Spot>) {
  const [number, setNumber] = useState(item?.number ?? '');
  const [zone, setZone] = useState(item?.zone ?? '');
  const [status, setStatus] = useState<Spot['status']>(item?.status ?? 'available');
  const [errors, setErrors] = useState<{ number?: string; zone?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const found: typeof errors = {};
    if (!number.trim()) found.number = 'Le numéro est obligatoire.';
    if (!zone.trim()) found.zone = 'La zone est obligatoire.';
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const body = { number: number.trim(), zone: zone.trim(), status };
      if (item) await api.put(`/admin/spots/${item.id}`, body);
      else await api.post('/admin/spots', body);
      onSaved(item ? 'Place modifiée.' : 'Place ajoutée.');
    } catch (e) {
      setServerError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Sheet visible title={item ? 'Modifier la place' : 'Nouvelle place'} onClose={onClose}
      footer={<Button title="Enregistrer" onPress={save} loading={saving} />}>
      <Input label="Numéro" placeholder="A-21" value={number} onChangeText={setNumber}
        error={errors.number} autoCapitalize="characters" editable={!saving} />
      <Input label="Zone" placeholder="Zone A" value={zone} onChangeText={setZone}
        error={errors.zone} editable={!saving} />
      <View style={styles.group}>
        <Text style={styles.label}>Statut</Text>
        <SegmentedControl
          value={status}
          onChange={setStatus}
          options={[
            { value: 'available', label: 'En service' },
            { value: 'out_of_service', label: 'Hors service' },
          ]}
        />
      </View>
      {serverError && <Notice message={serverError} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
});
