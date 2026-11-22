import { BTN, BTN_GHOST, FIELD, LABEL, Notice } from '@/components/admin/ui';
import { ALLOWED_EXTENSIONS } from '@/lib/assets';
import { requireAdmin } from '@/lib/auth';
import { storageConfigured } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';
import { deleteAsset, uploadAsset } from './actions';

const size = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export default async function AssetsPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin();
  const sb = createClient();
  const [{ data: assets }, { data: projects }] = await Promise.all([sb.from('assets').select('*, projects(name)').order('created_at', { ascending: false }).limit(100), sb.from('projects').select('id, name').order('name')]);
  return (
    <div className="max-w-[56rem]">
      <h1 className="text-h1 font-semibold">Asset library</h1>
      <p className="mt-2 max-w-[62ch] text-small text-ink-muted">Logos, screenshots and files in ZevCloud S3, with Supabase Storage as the fallback. Downloads use 60-second links.</p>
      {!storageConfigured() && <p className="mt-4 border border-warning p-4 text-small text-warning">No storage backend is configured. Set the ZEVCLOUD_S3_* variables, or SUPABASE_* plus a private bucket named by SUPABASE_STORAGE_BUCKET.</p>}
      <Notice error={searchParams.error} />

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {(assets ?? []).map((a) => (
          <li key={a.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-5">
            <div>
              <p className="break-all font-mono text-small">{a.name}</p>
              <p className="text-small text-ink-muted">{a.kind} / {size(a.size_bytes)} / {a.provider}{(a as { projects?: { name: string } }).projects?.name ? ` / ${(a as { projects?: { name: string } }).projects!.name}` : ''} / {new Date(a.created_at).toLocaleDateString('en-GB')}</p>
            </div>
            <div className="flex items-center gap-3">
              <a href={`/admin/assets/${a.id}/download`} className={BTN_GHOST}>Download</a>
              <form action={deleteAsset}><input type="hidden" name="id" value={a.id} /><button type="submit" className="font-mono text-label uppercase text-ink-muted hover:text-danger">Delete</button></form>
            </div>
          </li>
        ))}
        {(assets ?? []).length === 0 && <li className="py-3 text-small text-ink-muted">No assets uploaded.</li>}
      </ul>

      <form action={uploadAsset} className="mt-8 grid gap-5 border border-line p-5">
        <p className={LABEL}>Upload</p>
        <div><label className={LABEL} htmlFor="file">File</label><input id="file" name="file" type="file" required className={`${FIELD} file:mr-3 file:border-0 file:bg-bg-elevated file:px-3 file:py-2 file:text-small file:text-ink`} />
          <p className="mt-1 text-small text-ink-muted">Up to 10 MB. Allowed: {ALLOWED_EXTENSIONS.join(', ')}. Content is checked against the extension; SVG and HTML are not accepted.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label className={LABEL} htmlFor="kind">Type</label><select id="kind" name="kind" className={FIELD}><option value="logo">Logo</option><option value="screenshot">Screenshot</option><option value="document">Document</option><option value="export">Export</option><option value="other">Other</option></select></div>
          <div><label className={LABEL} htmlFor="project_id">Project</label><select id="project_id" name="project_id" className={FIELD}><option value="">None</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
        <button type="submit" className={`${BTN} w-fit`}>Upload</button>
      </form>
    </div>
  );
}
