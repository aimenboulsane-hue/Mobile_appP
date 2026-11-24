import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/Choices';
import { SelectField } from '@/components/SelectField';
import { Sheet } from '@/components/Sheet';
import { dateToSlot, SlotPicker, slotToDates, type SlotValue } from '@/components/SlotPicker';
import { ErrorState, LoadingState, Notice } from '@/components/States';
import { api, errorMessage } from '@/lib/api';
import { formatDateShort, formatPrice, formatTimeRange } from '@/lib/format';
import { reservationLabels } from '@/lib/labels';
import type { ClientRow, ParkingInfo, Reservation, Spot } from '@/lib/types';

import { CrudSection, type FormProps } from './CrudSection';

type Scope = 'upcoming' | 'past' | 'cancelled';

const AUTO_SPOT = 0;

export function ReservationsSection({ header }: { header: React.ReactNode }) {
  const [scope, setScope] = useState<Scope>('upcoming');
  return (
    <CrudSection<Reservation>
      header={header}
      toolbar={
        <SegmentedControl
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: 'À venir' },
            { value: 'past', label: 'Passées' },
            { value: 'cancelled', label: 'Annulées' },
          ]}
        />
      }
      fetchKey={scope}
      fetcher={async () =>
        (await api.get<{ reservations: Reservation[] }>(`/admin/reservations?scope=${scope}`)).reservations}
      keyOf={(r) => r.id}
      addLabel="Ajouter"
      countLabel={(n) => (n >= 100 ? '100 dernières réservations' : `${n} réservation${n > 1 ? 's' : ''}`)}
      empty={{ icon: 'calendar-outline', title: 'Aucune réservation', message: 'Aucune réservation dans cette catégorie.' }}
      renderRow={(r) => ({
        title: `${r.user_name ?? 'Client supprimé'} · ${r.spot_number ? `Place ${r.spot_number}` : 'Place supprimée'}`,
        lines: [
          `${formatDateShort(r.start_time)} · ${formatTimeRange(r.start_time, r.end_time)}`,
          r.paid_with_subscription ? 'Inclus dans l\'abonnement' : formatPrice(r.total_price),
        ],
        badges: <Badge {...reservationLabels[r.state]} />,
      })}
      canEdit={(r) => r.state === 'upcoming'}
      deletePath={(r) => `/admin/reservations/${r.id}`}
      deleteTitle="Supprimer cette réservation ?"
      deleteMessage={() => 'La réservation et son paiement seront supprimés définitivement de l\'historique.'}
      deletedMessage="Réservation supprimée."
      Form={ReservationForm}
    />
  );
}

type Options = { clients: ClientRow[]; spots: Spot[]; parking: ParkingInfo };

function ReservationForm({ item, onClose, onSaved }: FormProps<Reservation>) {
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [clients, spots, parking] = await Promise.all([
        api.get<{ clients: ClientRow[] }>('/admin/clients'),
        api.get<{ spots: Spot[] }>('/admin/spots'),
        api.get<ParkingInfo>('/parking'),
      ]);
      setOptions({ clients: clients.clients, spots: spots.spots, parking });
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const initialDuration = item
    ? (new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / 3600000
    : 1;
  const [clientId, setClientId] = useState<number | null>(item?.user_id ?? null);
  const [spotId, setSpotId] = useState<number>(item?.spot_id ?? AUTO_SPOT);
  const [slot, setSlot] = useState<SlotValue>(
    item ? dateToSlot(new Date(item.start_time), initialDuration) : { dayIndex: 0, startHour: null, duration: 1 });
  const [errors, setErrors] = useState<{ client?: string; slot?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const save = async () => {
    if (saving || cancelling) return;
    const dates = slotToDates(slot);
    const found: typeof errors = {};
    if (!clientId) found.client = 'Choisissez un client.';
    if (!dates) found.slot = 'Choisissez une heure de début.';
    setErrors(found);
    setServerError(null);
    if (!dates || Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const body = {
        user_id: clientId,
        spot_id: spotId === AUTO_SPOT ? null : spotId,
        start_time: dates.start.toISOString(),
        end_time: dates.end.toISOString(),
      };
      if (item) await api.put(`/admin/reservations/${item.id}`, body);
      else await api.post('/admin/reservations', body);
      onSaved(item ? 'Réservation modifiée.' : 'Réservation ajoutée.');
    } catch (e) {
      setServerError(errorMessage(e));
      setSaving(false);
    }
  };

  const cancelReservation = async () => {
    if (!item || saving || cancelling) return;
    setCancelling(true);
    setServerError(null);
    try {
      await api.put(`/admin/reservations/${item.id}`, { status: 'cancelled' });
      onSaved('Réservation annulée. Le paiement est remboursé.');
    } catch (e) {
      setServerError(errorMessage(e));
      setCancelling(false);
    }
  };

  return (
    <Sheet visible title={item ? 'Modifier la réservation' : 'Nouvelle réservation'} onClose={onClose}
      footer={options && (
        <>
          <Button title="Enregistrer" onPress={save} loading={saving} disabled={cancelling} />
          {item && (
            <Button title="Annuler cette réservation" variant="secondary" icon="close-circle-outline"
              onPress={cancelReservation} loading={cancelling} disabled={saving} />
          )}
        </>
      )}>
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
              options={options.clients.map((c) => ({ value: c.id, label: c.name, sublabel: c.email }))}
            />
          )}
          <SlotPicker value={slot} onChange={setSlot}
            openHour={options.parking.open_hour} closeHour={options.parking.close_hour} />
          {errors.slot && <Notice message={errors.slot} />}
          <SelectField
            label="Place"
            placeholder="Attribution automatique"
            value={spotId}
            onChange={setSpotId}
            options={[
              { value: AUTO_SPOT, label: 'Attribution automatique', sublabel: 'Première place libre' },
              ...options.spots
                .filter((s) => s.status === 'available')
                .map((s) => ({ value: s.id, label: `Place ${s.number}`, sublabel: s.zone })),
            ]}
          />
          {!item && (
            <Notice tone="primary" message="Le prix est calculé automatiquement. Paiement enregistré en espèces." />
          )}
          {serverError && <Notice message={serverError} />}
        </>
      )}
    </Sheet>
  );
}
