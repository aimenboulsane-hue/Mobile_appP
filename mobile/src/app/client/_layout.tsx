import { TabsLayout } from '@/components/TabsLayout';

export default function ClientLayout() {
  return (
    <TabsLayout
      tabs={[
        { name: 'home', title: 'Accueil', icon: 'home' },
        { name: 'reserve', title: 'Réserver', icon: 'calendar' },
        { name: 'subscriptions', title: 'Abonn.', icon: 'card' },
        { name: 'history', title: 'Historique', icon: 'time' },
        { name: 'profile', title: 'Profil', icon: 'person' },
      ]}
    />
  );
}
