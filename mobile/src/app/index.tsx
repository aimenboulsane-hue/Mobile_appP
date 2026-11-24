import { Redirect } from 'expo-router';

import { Screen } from '@/components/Screen';
import { LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { status, role } = useAuth();
  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <LoadingState label="Ouverture de SmartPark…" />
      </Screen>
    );
  }
  if (status === 'signedOut') return <Redirect href="/login" />;
  return <Redirect href={role === 'admin' ? '/admin/dashboard' : '/client/home'} />;
}
