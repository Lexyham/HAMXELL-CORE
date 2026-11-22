import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from '@/components/ProjectDetail';
import { getBySlug } from '@/lib/projects';

export const revalidate = 60;
type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getBySlug(params.slug, 'public');
  return p ? { title: p.name, description: p.summary } : {};
}

export default async function ProductPage({ params }: Props) {
  const p = await getBySlug(params.slug, 'public');
  if (!p) notFound();
  return <ProjectDetail p={p} />;
}
