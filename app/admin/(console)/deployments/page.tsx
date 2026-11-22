import { BTN, BTN_GHOST, FIELD, LABEL, Notice } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { addDeployment, deleteDeployment } from './actions';

const TONE = { success: 'border-success text-success', failed: 'border-danger text-danger', rolled_back: 'border-warning text-warning' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DeploymentsPage({ searchParams }: { searchParams: { error?: string; project?: string } }) {
  await requireAdmin();
  const sb = createClient();
  let q = sb.from('deployments').select('*, projects(name)').order('deployed_at', { ascending: false }).limit(60);
  if (searchParams.project && UUID.test(searchParams.project)) q = q.eq('project_id', searchParams.project);
  const [{ data: rows }, { data: projects }] = await Promise.all([q, sb.from('projects').select('id, name').order('name')]);

  return (
    <div className="max-w-[56rem]">
      <h1 className="text-h1 font-semibold">Deployments</h1>
      <p className="mt-2 text-small text-ink-muted">A manual record of releases and versions per project.</p>

      <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
        <div><label className={LABEL} htmlFor="f">Filter by project</label>
          <select id="f" name="project" defaultValue={searchParams.project ?? ''} className={FIELD}><option value="">All projects</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <button type="submit" className={BTN_GHOST}>Apply</button>
      </form>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {(rows ?? []).map((d) => (
          <li key={d.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:gap-5">
            <div>
              <p className="text-body"><span className="font-mono font-medium">{d.version}</span> <span className="text-ink-muted">/ {(d as { projects?: { name: string } }).projects?.name} / {d.environment}</span></p>
              <p className="text-small text-ink-muted">{new Date(d.deployed_at).toLocaleString('en-GB')}{d.platform ? ` / ${d.platform}` : ''}{d.commit_ref ? ` / ${d.commit_ref}` : ''}</p>
              {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="break-all text-small underline decoration-brand-gold">{d.url}</a>}
              {d.notes && <p className="mt-1 max-w-[60ch] text-small text-ink-muted">{d.notes}</p>}
            </div>
            <div className="flex items-start gap-3">
              <span className={`border px-2 py-[2px] font-mono text-label uppercase ${TONE[d.status as keyof typeof TONE]}`}>{String(d.status).replace('_', ' ')}</span>
              <form action={deleteDeployment}><input type="hidden" name="id" value={d.id} /><button type="submit" className="font-mono text-label uppercase text-ink-muted hover:text-danger">Delete</button></form>
            </div>
          </li>
        ))}
        {(rows ?? []).length === 0 && <li className="py-4 text-small text-ink-muted">No deployments recorded.</li>}
      </ul>

      <h2 className="mt-8 font-mono text-label uppercase text-ink-muted">Record a deployment</h2>
      <Notice error={searchParams.error} />
      <form action={addDeployment} className="mt-4 grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label className={LABEL} htmlFor="project_id">Project</label><select id="project_id" name="project_id" required className={FIELD}><option value="">Choose</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className={LABEL} htmlFor="version">Version</label><input id="version" name="version" required maxLength={60} placeholder="v1.4.0" className={`${FIELD} font-mono`} /></div>
          <div><label className={LABEL} htmlFor="environment">Environment</label><select id="environment" name="environment" className={FIELD}><option value="production">Production</option><option value="staging">Staging</option><option value="preview">Preview</option></select></div>
          <div><label className={LABEL} htmlFor="status">Outcome</label><select id="status" name="status" className={FIELD}><option value="success">Success</option><option value="failed">Failed</option><option value="rolled_back">Rolled back</option></select></div>
          <div><label className={LABEL} htmlFor="platform">Platform</label><input id="platform" name="platform" placeholder="ZevCloud" className={FIELD} /></div>
          <div><label className={LABEL} htmlFor="url">Live URL</label><input id="url" name="url" type="url" className={FIELD} /></div>
          <div><label className={LABEL} htmlFor="commit_ref">Commit / tag</label><input id="commit_ref" name="commit_ref" maxLength={80} className={`${FIELD} font-mono`} /></div>
          <div><label className={LABEL} htmlFor="deployed_at">Deployed at</label><input id="deployed_at" name="deployed_at" type="datetime-local" className={FIELD} /><p className="mt-1 text-small text-ink-muted">Leave empty for now.</p></div>
        </div>
        <div><label className={LABEL} htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={3} className={FIELD} /></div>
        <button type="submit" className={`${BTN} w-fit`}>Record deployment</button>
      </form>
    </div>
  );
}
