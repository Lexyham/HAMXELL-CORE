import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { flag } from '@/lib/flags';
import { createClient } from '@/lib/supabase/server';
import { analyzeUrl } from './actions';

export default async function ImporterPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin();
  if (!flag('FEATURE_PROJECT_IMPORTER')) {
    return (
      <div>
        <h1 className="text-h1 font-semibold">Project importer</h1>
        <p className="mt-4 border border-line p-5 text-small text-ink-muted">Coming soon. Set FEATURE_PROJECT_IMPORTER=true to enable.</p>
      </div>
    );
  }
  const { data } = await createClient().from('project_imports').select('id, source_url, created_at').order('created_at', { ascending: false }).limit(15);

  return (
    <div className="max-w-[48rem]">
      <h1 className="text-h1 font-semibold">Project importer</h1>
      <p className="mt-3 max-w-[56ch] text-small text-ink-muted">
        Enter a public website. It is reviewed quietly in the background, and you get a written description of what the site is, what it offers, how it appears to be built and how well it is run. Optionally add a public GitHub repository. Back-end logic and private systems cannot be seen from a public address.
      </p>

      <form action={analyzeUrl} className="mt-6">
        <label htmlFor="url" className="block font-mono text-label uppercase text-ink-muted">Website URL</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input id="url" name="url" type="url" required placeholder="https://example.com" className="w-full border border-line bg-bg-secondary px-3 py-3 text-body focus:border-brand-blue focus:outline-none" />
          <button type="submit" className="border border-brand-blue bg-brand-blue px-6 py-3 text-small font-medium hover:bg-transparent sm:shrink-0">Analyze</button>
        </div>
        <label htmlFor="repo" className="mt-5 block font-mono text-label uppercase text-ink-muted">GitHub repository (optional)</label>
        <input id="repo" name="repo" placeholder="owner/name or https://github.com/owner/name" className="mt-2 w-full border border-line bg-bg-secondary px-3 py-3 text-body focus:border-brand-blue focus:outline-none" />
        <p className="mt-1 text-small text-ink-muted">Public repositories only. Adds the repository's description, languages and licence to the write-up from GitHub metadata and the root file listing; source code is not read.</p>
        {searchParams.error && <p role="alert" className="mt-3 text-small text-danger">{searchParams.error}</p>}
        <p className="mt-3 text-small text-ink-muted">Public http(s) pages only. Private networks are blocked, robots.txt is respected, 10 second timeout, 5 MB limit.</p>
      </form>

      <h2 className="mt-8 font-mono text-label uppercase text-ink-muted">Recent imports</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {(data ?? []).map((i) => (
          <li key={i.id}>
            <Link href={`/admin/importer/${i.id}`} className="grid gap-1 py-3 hover:bg-bg-secondary sm:grid-cols-[1fr_auto] sm:gap-5">
              <span className="break-all text-small">{i.source_url}</span>
              <span className="font-mono text-label uppercase text-ink-muted">{new Date(i.created_at).toLocaleDateString('en-GB')}</span>
            </Link>
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="py-3 text-small text-ink-muted">No imports yet.</li>}
      </ul>
    </div>
  );
}
