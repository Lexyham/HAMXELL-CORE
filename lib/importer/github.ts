/** Review of a PUBLIC GitHub repository through GitHub's public API (fixed host). Reads metadata and the root file listing only, never source code. */
export interface RepoFacts {
  fullName: string; url: string; description: string | null; defaultBranch: string; archived: boolean; fork: boolean;
  license: string | null; stars: number; forks: number; openIssues: number; pushedAt: string; createdAt: string; sizeKb: number;
  topics: string[]; languages: { name: string; pct: number }[]; rootFiles: { name: string; type: string; size: number }[];
}

export class RepoError extends Error {}
export type RepoFetch = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const s = input.trim();
  const m = s.match(/^(?:https?:\/\/(?:www\.)?github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:[/?#].*)?$/);
  if (!m || /^(https?:)$/i.test(m[1])) return null;
  if (!/^https?:\/\//i.test(s) && s.includes('github.com')) return null;
  return { owner: m[1], repo: m[2] };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchRepo(input: string, deps: { fetch?: RepoFetch; token?: string } = {}): Promise<RepoFacts> {
  const ref = parseRepoUrl(input);
  if (!ref) throw new RepoError('Enter a GitHub repository as owner/name or a github.com address.');
  const f: RepoFetch = deps.fetch ?? ((u, i) => fetch(u, { ...i, cache: 'no-store' }));
  const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'HAMXELL-CORE-Importer/1.0', 'x-github-api-version': '2022-11-28' };
  if (deps.token) headers.authorization = `Bearer ${deps.token}`;
  const base = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  const get = async (path: string): Promise<any> => {
    let r;
    try { r = await f(base + path, { headers, signal: AbortSignal.timeout(10_000) }); } catch { throw new RepoError('GitHub could not be reached.'); }
    if (r.status === 404) throw new RepoError('The repository was not found, or it is not public.');
    if (r.status === 403 || r.status === 429) throw new RepoError('GitHub\u2019s rate limit was reached. Try again later, or set GITHUB_TOKEN for a higher limit.');
    if (!r.ok) throw new RepoError(`GitHub responded with HTTP ${r.status}.`);
    return r.json();
  };
  const repo = await get('');
  if (repo.private) throw new RepoError('Only public repositories can be reviewed.');
  const [langs, root] = await Promise.all([get('/languages').catch(() => ({})), get('/contents/').catch(() => [])]);
  const total = Object.values(langs as Record<string, number>).reduce((a, b) => a + b, 0) || 1;
  return {
    fullName: repo.full_name, url: repo.html_url, description: repo.description ?? null, defaultBranch: repo.default_branch, archived: !!repo.archived, fork: !!repo.fork,
    license: repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : repo.license?.name ?? null,
    stars: repo.stargazers_count ?? 0, forks: repo.forks_count ?? 0, openIssues: repo.open_issues_count ?? 0, pushedAt: repo.pushed_at, createdAt: repo.created_at, sizeKb: repo.size ?? 0,
    topics: repo.topics ?? [],
    languages: Object.entries(langs as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, v]) => ({ name, pct: Math.round((v / total) * 100) })),
    rootFiles: (Array.isArray(root) ? root : []).slice(0, 200).map((e: any) => ({ name: String(e.name), type: String(e.type), size: Number(e.size ?? 0) })),
  };
}
