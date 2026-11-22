import type { Metadata } from 'next';
import CategoryPage from '@/components/CategoryPage';

export const metadata: Metadata = { title: 'Labs' };

export default function LabsPage() {
  return <CategoryPage category="lab" eyebrow="Labs" title="Labs" intro="Research, development and concept work." />;
}
