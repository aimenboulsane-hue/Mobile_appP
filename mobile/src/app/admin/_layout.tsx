import { TabsLayout } from '@/components/TabsLayout';

export default function AdminLayout() {
  return (
    <TabsLayout
      tabs={[
        { name: 'dashboard', title: 'Tableau de bord', icon: 'stats-chart' },
        { name: 'recommendations', title: 'IA', icon: 'sparkles' },
        { name: 'manage', title: 'Gestion', icon: 'list' },
        { name: 'profile', title: 'Profil', icon: 'person' },
      ]}
    />
  );
}
