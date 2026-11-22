import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from '@/components/ProjectDetail';
import { flag } from '@/lib/flags';
import { getBySlug } from '@/lib/projects';

type Props = { params: { slug: string } };
const noindex = { index: false, follow: false } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = flag('FEATURE_UNLISTED_PROJECTS') ? await getBySlug(params.slug, 'unlisted') : null;
  return { title: p?.name, robots: noindex };
}

/** Unlisted: reachable by direct URL only, never listed, always noindex. */
export default async function UnlistedPage({ params }: Props) {
  if (!flag('FEATURE_UNLISTED_PROJECTS')) notFound();
  const p = await getBySlug(params.slug, 'unlisted');
  if (!p) notFound();
  return <ProjectDetail p={p} />;
}
