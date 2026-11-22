import type { Metadata } from 'next';
import CategoryPage from '@/components/CategoryPage';

export const metadata: Metadata = { title: 'Experiments' };

export default function ExperimentsPage() {
  return <CategoryPage category="experiment" eyebrow="Experiments" title="Experiments" intro="Small and informal projects. Useful, unfinished, or both." />;
}
