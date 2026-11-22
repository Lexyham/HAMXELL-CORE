import Link from 'next/link';
import { notFound } from 'next/navigation';
import DeleteButton from '@/components/admin/DeleteButton';
import ProjectForm from '@/components/admin/ProjectForm';
import { requireAdmin } from '@/lib/auth';
import { fromRow } from '@/lib/projects';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProjectPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  await requireAdmin();
  if (!UUID.test(params.id)) notFound();
  const { data } = await createClient().from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const p = fromRow(data);
  const { data: gate } = await createClient().from('project_gates').select('project_id').eq('project_id', p.id!).maybeSingle();
  const viewHref = p.visibility === 'public' ? `/products/${p.slug}` : p.visibility === 'unlisted' ? `/u/${p.slug}` : p.visibility === 'warning' ? `/p/${p.slug}` : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-semibold">{p.name}</h1>
        <div className="flex items-center gap-3">
          <Link href={`/admin/projects/${p.id}/docs`} className="border border-line px-4 py-2 font-mono text-label uppercase hover:border-ink">Documentation</Link>
          {viewHref && <Link href={viewHref} target="_blank" className="border border-line px-4 py-2 font-mono text-label uppercase hover:border-ink">View live</Link>}
          <DeleteButton id={p.id!} name={p.name} />
        </div>
      </div>
      {searchParams.error && <p role="alert" className="mt-4 text-small text-danger">{searchParams.error}</p>}
      <div className="mt-6"><ProjectForm project={p} hasGate={Boolean(gate)} /></div>
    </div>
  );
}
