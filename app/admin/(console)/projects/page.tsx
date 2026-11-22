import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { STATUS_LABEL, VISIBILITY_LABEL } from '@/lib/products';
import { fromRow } from '@/lib/projects';
import { createClient } from '@/lib/supabase/server';

export default async function ProjectsAdminPage() {
  await requireAdmin();
  const { data } = await createClient().from('projects').select('*').order('updated_at', { ascending: false });
  const projects = (data ?? []).map(fromRow);

  return (
    <div className="max-w-[60rem]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-semibold">Projects</h1>
        <Link href="/admin/projects/new" className="border border-brand-blue bg-brand-blue px-5 py-3 text-small font-medium hover:bg-transparent">New project</Link>
      </div>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/projects/${p.id}`} className="grid gap-1 py-4 hover:bg-bg-secondary sm:grid-cols-[1fr_auto] sm:items-center sm:gap-5">
              <span>
                <span className="block text-body font-medium">{p.name}</span>
                <span className="block font-mono text-small text-ink-muted">{p.slug}</span>
              </span>
              <span className="font-mono text-label uppercase text-ink-muted">{VISIBILITY_LABEL[p.visibility]} / {STATUS_LABEL[p.status]}</span>
            </Link>
          </li>
        ))}
        {projects.length === 0 && <li className="py-4 text-small text-ink-muted">No projects yet.</li>}
      </ul>
    </div>
  );
}
