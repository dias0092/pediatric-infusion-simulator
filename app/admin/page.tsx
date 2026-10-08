import type { Metadata } from 'next';
import { AdminScreen } from '@/components/screens/AdminScreen';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminScreen />;
}
