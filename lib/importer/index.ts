import 'server-only';
import { runChecks, runRepoChecks, type Finding } from './audit';
import { analyzeHtml, type ImportResult } from './analyze';
import { crawlSite, type Fetcher } from './crawl';
import { fetchRepo, RepoError, type RepoFacts, type RepoFetch } from './github';
import { buildReport, type Narrative } from './report';
import { fetchSafe, parseTarget } from './safe-fetch';

export type { ImportResult } from './analyze';
export { CrawlError } from './safe-fetch';

/** Reviews a site (landing page, further internal pages, robots.txt, sitemap, headers) and writes the audit report. */
export async function analyzeSiteDetailed(input: string, deps: { fetch?: Fetcher; repo?: string; repoFetch?: RepoFetch } = {}) {
  const target = parseTarget(input.trim());
  const { crawl, homeRaw } = await crawlSite(target.toString(), {
    fetch: deps.fetch ?? ((u, o) => fetchSafe(u, 4, o)),
    maxPages: Number(process.env.IMPORTER_MAX_PAGES ?? 6),
    linkChecks: Number(process.env.IMPORTER_LINK_CHECKS ?? 20),
    deadlineMs: Number(process.env.IMPORTER_DEADLINE_MS ?? 60_000),
  });
  const base = analyzeHtml(homeRaw.body, homeRaw.headers, homeRaw.url, target.toString());
  if (homeRaw.truncated) base.notes.unshift('The landing page exceeded the size cap and was truncated; results may be incomplete.');
  const findings: Finding[] = runChecks(crawl);
  let repo: RepoFacts | undefined, repoError: string | undefined;
  if (deps.repo?.trim()) {
    try { repo = await fetchRepo(deps.repo, { fetch: deps.repoFetch, token: process.env.GITHUB_TOKEN }); findings.push(...runRepoChecks(repo)); }
    catch (e) {
      repoError = e instanceof RepoError ? e.message : 'The repository could not be reviewed.';
      findings.push({ id: 'REP-00', area: 'Repository', title: 'Repository review', outcome: 'note', severity: 'info', observation: `The repository could not be reviewed: ${repoError}`, recommendation: 'Check the address and that the repository is public, then run the review again.', basis: 'observed' });
    }
  }
  const result: ImportResult = { ...base, schema: 2, crawl, findings, repo, repoError, reportMd: buildReport({ crawl, findings, tech: base.tech, repo }), files: {} };
  return { result, page: { url: homeRaw.url, status: homeRaw.status, headers: homeRaw.headers as Record<string, unknown>, body: homeRaw.body, truncated: homeRaw.truncated } };
}

export async function analyzeSite(input: string): Promise<ImportResult> {
  return (await analyzeSiteDetailed(input)).result;
}

/** Re-writes the report, for example after an AI narrative has been added. Findings are never changed. */
export function withNarrative(r: ImportResult, narrative?: Narrative): ImportResult {
  if (!r.crawl || !r.findings) return r;
  return { ...r, reportMd: buildReport({ crawl: r.crawl, findings: r.findings, tech: r.tech, narrative, repo: r.repo }) };
}
