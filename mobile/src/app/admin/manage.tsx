import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/Choices';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ClientsSection } from '@/features/admin/ClientsSection';
import { ReservationsSection } from '@/features/admin/ReservationsSection';
import { SpotsSection } from '@/features/admin/SpotsSection';
import { SubscriptionsSection } from '@/features/admin/SubscriptionsSection';
import { spacing } from '@/theme';

type Section = 'spots' | 'clients' | 'reservations' | 'subscriptions';

const SUBTITLES: Record<Section, string> = {
  spots: 'Les places du parking',
  clients: 'Les comptes clients',
  reservations: 'Toutes les réservations',
  subscriptions: 'Les abonnements des clients',
};

export default function ManageScreen() {
  const [section, setSection] = useState<Section>('spots');

  const header = (
    <View>
      <ScreenHeader title="Gestion" subtitle={SUBTITLES[section]} />
      <View style={styles.tabs}>
        <SegmentedControl
          value={section}
          onChange={setSection}
          options={[
            { value: 'spots', label: 'Places' },
            { value: 'clients', label: 'Clients' },
            { value: 'reservations', label: 'Réserv.' },
            { value: 'subscriptions', label: 'Abonn.' },
          ]}
        />
      </View>
    </View>
  );

  if (section === 'spots') return <SpotsSection header={header} />;
  if (section === 'clients') return <ClientsSection header={header} />;
  if (section === 'reservations') return <ReservationsSection header={header} />;
  return <SubscriptionsSection header={header} />;
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
