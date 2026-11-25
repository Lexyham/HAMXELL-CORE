import 'server-only';
import { analyzeHtml, type ImportResult } from './analyze';
import { crawlSite, type Fetcher } from './crawl';
import { fetchRepo, RepoError, type RepoFetch } from './github';
import { fetchSafe, parseTarget } from './safe-fetch';

export type { ImportResult } from './analyze';
export { CrawlError } from './safe-fetch';

/**
 * Reads a site the way a polite crawler would (landing page, further internal pages, robots.txt, sitemap, headers)
 * and keeps what was found. The written description is produced from this afterwards; nothing here is shown as a report.
 */
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
  let repo: ImportResult['repo'], repoError: string | undefined;
  if (deps.repo?.trim()) {
    try { repo = await fetchRepo(deps.repo, { fetch: deps.repoFetch, token: process.env.GITHUB_TOKEN }); }
    catch (e) { repoError = e instanceof RepoError ? e.message : 'The repository could not be reviewed.'; }
  }
  const result: ImportResult = { ...base, schema: 2, crawl, repo, repoError, files: {} };
  return { result, page: { url: homeRaw.url, status: homeRaw.status, headers: homeRaw.headers as Record<string, unknown>, body: homeRaw.body, truncated: homeRaw.truncated } };
}

export async function analyzeSite(input: string): Promise<ImportResult> {
  return (await analyzeSiteDetailed(input)).result;
}
