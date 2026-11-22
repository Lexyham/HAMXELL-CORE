import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WarningGate from '@/components/WarningGate';
import { flag } from '@/lib/flags';
import { STATUS_LABEL } from '@/lib/products';
import { gateRequired, getBySlug } from '@/lib/projects';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = flag('FEATURE_WARNING_GATED_PROJECTS') ? await getBySlug(params.slug, 'warning') : null;
  return { title: p?.name, robots: { index: false, follow: false } };
}

/** Warning-gated: notice first; description and launch link are fetched only after acknowledgement. */
export default async function WarningPage({ params }: Props) {
  if (!flag('FEATURE_WARNING_GATED_PROJECTS')) notFound();
  const p = await getBySlug(params.slug, 'warning');
  if (!p) notFound();
  const needsPassword = await gateRequired(p.slug);
  return <WarningGate needsPassword={needsPassword} slug={p.slug} name={p.name} summary={p.summary} statusLabel={STATUS_LABEL[p.status]} warningText={p.warningText ?? null} />;
}
