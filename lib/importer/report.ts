import { AREAS, OUTCOME_LABEL, PRIORITY_LABEL, SEVERITY_ORDER, type Area, type Finding } from './audit';
import type { SiteCrawl } from './crawl';
import type { RepoFacts } from './github';
import { and, be, cell, code, kb, n, path, pl, spell } from './md';

export interface Narrative { summary: string; conclusion: string; provider: string; model: string }
export interface ReportInput { crawl: SiteCrawl; findings: Finding[]; tech: { name: string; evidence: string }[]; narrative?: Narrative; repo?: RepoFacts }

const lower = (s: string) => s.toLowerCase();
const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const bySeverity = (a: Finding, b: Finding) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id.localeCompare(b.id);

/** Text produced by an AI model is untrusted: remove link syntax and table-breaking characters before it goes into the report. */
export function safeNarrative(s: string, max = 1800): string {
  return s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`/g, "'").replace(/\|/g, '\u00a6').replace(/^#+\s*/gm, '').replace(/\r/g, '').trim().slice(0, max);
}

export function summarise(findings: Finding[]) {
  const issues = findings.filter((f) => f.outcome === 'attention' || f.outcome === 'fail');
  return {
    total: findings.length,
    pass: findings.filter((f) => f.outcome === 'pass').length,
    note: findings.filter((f) => f.outcome === 'note').length,
    attention: findings.filter((f) => f.outcome === 'attention').length,
    fail: findings.filter((f) => f.outcome === 'fail').length,
    high: issues.filter((f) => f.severity === 'high').length,
    medium: issues.filter((f) => f.severity === 'medium').length,
    low: issues.filter((f) => f.severity === 'low').length,
    issues: issues.sort(bySeverity),
  };
}

/** Writes the full audit report as Markdown. Pure: the same inputs always give the same document. */
export function buildReport({ crawl: c, findings, tech, narrative, repo }: ReportInput): string {
  const f = c.home.facts, h = c.home.headers;
  const s = summarise(findings);
  const host = new URL(c.finalUrl).hostname;
  const name = f.title || host;
  const reviewed = c.pages.filter((p) => !p.skipped && !p.error);
  const L: string[] = [];
  const add = (...x: string[]) => L.push(...x);

  add(`# Website Audit Report: ${name.replace(/[#*_`\[\]|<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)}`, '');
  add('| Item | Detail |', '| --- | --- |',
    `| Subject | ${code(host)} |`, `| Address reviewed | ${code(c.finalUrl)} |`, `| Review date | ${date(c.fetchedAt)} |`,
    `| Pages examined | ${n(reviewed.length)} of ${n(c.internalLinksFound + 1)} internal addresses discovered |`,
    '| Method | Automated review of public pages, response headers, robots.txt and sitemap |', '| Status | Draft for review |', '');

  /* 1 ----------------------------------------------------------------------------- */
  add('## 1. Executive summary', '');
  const techNames = tech.map((t) => t.name);
  add(`This report records an automated review of ${code(c.finalUrl)}, carried out on ${date(c.fetchedAt)}. The review examined ${pl(reviewed.length, 'page')} of the public website, together with its robots.txt file, XML sitemap and response headers. ${f.title ? `The site presents itself as ${code(f.title, 80)}${f.description ? `, describing its purpose as ${code(f.description, 160)}` : ' and publishes no description of its purpose in its page metadata'}.` : `The landing page declares no title, so the site is identified in this report by its address, ${code(host)}${f.description ? `; its metadata describes its purpose as ${code(f.description, 160)}` : ', and its metadata publishes no description of its purpose'}.`} ${techNames.length ? `From the page source it appears to be built with ${and(techNames.slice(0, 6))} (inferred).` : 'No recognisable technology signatures were found in the page source.'}`, '');
  const sentence = s.high > 0 ? `The high-priority findings should be addressed first, because they affect ${and([...new Set(s.issues.filter((i) => i.severity === 'high').map((i) => lower(i.area)))])}.`
    : s.medium > 0 ? 'No high-priority defects were found. The medium-priority findings are the principal opportunities for improvement.'
    : s.low > 0 ? 'No high or medium-priority defects were found; the remaining items are low-priority refinements.'
    : 'No defects were found within the scope of this review.';
  add(`The review applied ${pl(s.total, 'check')} across ${spell(new Set(findings.map((x) => x.area)).size)} areas. Of these, ${n(s.pass)} ${be(s.pass)} satisfied, ${n(s.attention)} raised matters needing attention, ${n(s.fail)} failed and ${n(s.note)} ${s.note === 1 ? 'is' : 'are'} recorded as notes. The ${n(s.issues.length)} findings that require action are rated ${n(s.high)} high, ${n(s.medium)} medium and ${n(s.low)} low priority. ${sentence}`, '');
  const strengths: string[] = [];
  for (const area of AREAS) { const p = findings.find((x) => x.area === area && x.outcome === 'pass'); if (p && strengths.length < 3) strengths.push(p.title); }
  const concerns = s.issues.slice(0, 3).map((i) => `${i.title} (${i.id})`);
  add(`${strengths.length ? `Checks that were satisfied include ${and(strengths)}. ` : ''}${concerns.length ? `The most significant concerns are ${and(concerns)}.` : 'There were no concerns requiring action.'}`, '');
  if (narrative) add(`> **Reviewer's summary** (written with AI assistance using ${narrative.provider}, based only on the findings in this report):`, '>', ...safeNarrative(narrative.summary).split(/\n+/).map((p) => `> ${p}`), '');
  if (s.issues.length) {
    add('**Priority actions**', '');
    s.issues.slice(0, 5).forEach((i, k) => add(`${k + 1}. **${i.title} (${i.id}).** ${cell(i.recommendation)}`));
    add('');
  }

  /* 2 ----------------------------------------------------------------------------- */
  add('## 2. Scope, method and limitations', '');
  add(`The review was carried out on ${date(c.fetchedAt)} by the HAMXELL CORE importer, an automated tool.${repo ? ` The public GitHub repository ${code(repo.fullName)} was also reviewed through GitHub\u2019s public API, from its metadata and root file listing only.` : ''} The website review requested ${code(c.sourceUrl)} and examined the markup and response headers of the landing page. It then followed up to ${n(c.limits.maxPages - 1)} further internal links, taking navigation links first, and checked the response status of up to ${n(c.limits.linkChecks)} others. It read robots.txt and the XML sitemap and tested whether the server compresses its responses. Requests were made one at a time, identified the tool by name, honoured robots.txt and were made from a single location.`, '');
  add('Each check produces one of four outcomes: Pass, Attention, Fail or Note. Findings that need action are rated by priority; the scale is set out in Appendix B. Statements marked as observed come directly from the responses received. Statements marked as inferred are conclusions drawn from them, such as the technology profile.', '');
  add('The following limitations apply:', '');
  add('- Only publicly reachable pages were examined. Nothing behind a login was reviewed, and no scripts were executed, so content generated in the browser is not visible to this review.');
  add(`- Page-level findings describe the ${spell(reviewed.length)} ${reviewed.length === 1 ? 'page' : 'pages'} examined. The remainder of the site was not assessed.`);
  add('- The accessibility checks are automated heuristics. They detect only a minority of the problems a person would find and do not replace testing with assistive technology or a manual review against WCAG.');
  add('- Response time is a single measurement from one location and varies with distance and load.');
  add(repo ? '- The repository review used only GitHub metadata and the names of files at the repository root. The source code itself was not read, so application logic, dependency versions and configuration contents were not assessed.' : '- Back-end logic, database structure, source code and private endpoints cannot be assessed from a public address. A review of the repository would be needed for those.');
  if (f.words < 80 && f.scripts.external >= 3) add('- The landing page contained little text in its initial HTML but loaded several scripts, which suggests that content is rendered in the browser (inferred). If so, this review understates what visitors see.');
  if (c.truncatedCrawl) add('- The review stopped early because it reached its time limit, so some discovered links were not examined.');
  add('');

  /* 3 ----------------------------------------------------------------------------- */
  add('## 3. Site profile', '');
  add('| Item | Detail |', '| --- | --- |',
    `| Title | ${code(f.title || '(none)', 90)} |`, `| Description | ${f.description ? code(f.description, 120) : 'None published'} |`,
    `| HTTP status | ${c.home.status} |`, `| Language | ${f.lang ? code(f.lang, 20) : 'Not declared'} |`,
    `| Server software | ${h.server ? code(String(h.server), 40) : 'Not disclosed'} |`, `| Technologies (inferred) | ${techNames.length ? and(techNames) : 'None recognised'} |`,
    `| Navigation items | ${n(f.nav.length)} |`, `| HTML size | ${kb(f.bytes)} before compression |`, `| Response time | ${n(c.home.ms)} ms (single measurement) |`,
    `| Third-party hosts | ${n(new Set([...f.scripts.thirdPartyHosts, ...f.styles.thirdPartyHosts]).size)} |`, ...(repo ? [`| Repository | ${code(repo.fullName)}, last push ${date(repo.pushedAt)} |`] : []), '');

  /* 4 ----------------------------------------------------------------------------- */
  add('## 4. Findings by area', '');
  AREAS.forEach((area: Area, i) => {
    const fs = findings.filter((x) => x.area === area);
    if (!fs.length) return;
    const issues = fs.filter((x) => x.outcome === 'attention' || x.outcome === 'fail');
    const pass = fs.filter((x) => x.outcome === 'pass').length, notes = fs.filter((x) => x.outcome === 'note').length;
    const sev = (k: 'high' | 'medium' | 'low') => issues.filter((x) => x.severity === k).length;
    add(`### 4.${i + 1} ${area}`, '');
    add(`${area} was assessed through ${pl(fs.length, 'check')}. Of these, ${n(pass)} ${be(pass)} satisfied${issues.length ? `, and ${n(issues.length)} raised ${issues.length === 1 ? 'a concern' : 'concerns'} (${and([sev('high') && `${n(sev('high'))} high`, sev('medium') && `${n(sev('medium'))} medium`, sev('low') && `${n(sev('low'))} low`].filter(Boolean) as string[])} priority)` : ''}${notes ? `${issues.length ? '; ' : ', and '}${pl(notes, 'item')} ${notes === 1 ? 'is' : 'are'} recorded as ${notes === 1 ? 'a note' : 'notes'}` : ''}.`, '');
    add('| ID | Check | Result | Observation |', '| --- | --- | --- | --- |', ...fs.map((x) => `| ${x.id} | ${cell(x.title)} | ${OUTCOME_LABEL[x.outcome]} | ${cell(x.observation)} |`), '');
    const rec = fs.filter((x) => x.recommendation).sort(bySeverity);
    if (rec.length) { add('**Recommendations**', ''); for (const x of rec) add(`- **${x.id}, ${x.title}.** ${cell(x.recommendation)}`); add(''); }
  });

  /* 5 ----------------------------------------------------------------------------- */
  add('## 5. Page inventory', '');
  add(`In all, ${pl(c.pages.length, 'page')} ${be(c.pages.length)} requested. The table records what each returned.`, '');
  add('| Page | Status | Time | Title | H1 | Words | Notes |', '| --- | --- | --- | --- | --- | --- | --- |', ...c.pages.map((p) => {
    const notes = [p.skipped && `skipped: ${p.skipped}`, p.error, p.noindex && 'noindex', p.imagesMissingAlt > 0 && `${pl(p.imagesMissingAlt, 'image')} without alt`, p.status >= 400 && 'error response'].filter(Boolean).join('; ');
    return `| ${code(path(p.url), 40)} | ${p.status || 'none'} | ${p.ms ? `${n(p.ms)} ms` : '-'} | ${p.title ? code(p.title, 40) : '-'} | ${p.status && p.status < 400 ? p.h1 : '-'} | ${p.words || '-'} | ${cell(notes) || '-'} |`;
  }), '');
  const probe = c.linkChecks;
  if (probe.length) { const bad = probe.filter((l) => l.status >= 400 || l.status === 0); add(`A further ${pl(probe.length, 'internal link')} ${probe.length === 1 ? 'was' : 'were'} checked for response status only. ${bad.length ? `${pl(bad.length, 'returned an error or no response', 'returned an error or no response')}: ${and(bad.slice(0, 6).map((b) => `${code(path(b.url), 50)} (${b.status || 'no response'})`))}.` : 'All responded successfully.'}`, ''); }

  /* 6 ----------------------------------------------------------------------------- */
  add('## 6. Findings register', '');
  if (s.issues.length) {
    add(`The register lists the ${pl(s.issues.length, 'finding')} that require action, ordered by priority.`, '');
    add('| ID | Priority | Area | Finding | Recommendation | Basis |', '| --- | --- | --- | --- | --- | --- |', ...s.issues.map((x) => `| ${x.id} | ${PRIORITY_LABEL[x.severity]} | ${cell(x.area)} | ${cell(`${x.title}. ${x.observation}`)} | ${cell(x.recommendation)} | ${x.basis === 'observed' ? 'Observed' : 'Inferred'} |`), '');
  } else add('No findings requiring action were identified within the scope of this review.', '');

  /* 7 ----------------------------------------------------------------------------- */
  add('## 7. Recommendations and next steps', '');
  const group = (sev: 'high' | 'medium' | 'low', head: string, lead: string) => {
    const g = s.issues.filter((x) => x.severity === sev);
    if (!g.length) return;
    add(`**${head}**`, '', lead, '');
    g.forEach((x) => add(`- ${x.id}, ${x.title}: ${cell(x.recommendation)}`));
    add('');
  };
  group('high', 'Immediate (high priority)', 'These items carry the greatest risk or harm and should be resolved first.');
  group('medium', 'Short term (medium priority)', 'These are meaningful weaknesses that should be planned into the next round of work.');
  group('low', 'Housekeeping (low priority)', 'These are minor weaknesses and refinements that can be addressed as part of routine maintenance.');
  add('**Beyond this review**', '');
  add('- Extend the review to every page of the site; this one examined a sample.');
  add('- Test accessibility manually, with a keyboard and a screen reader, against the Web Content Accessibility Guidelines.');
  add('- Measure performance on real devices and networks with a laboratory tool and field data, rather than a single request.');
  add(repo ? '- Read the source code itself, which this review did not do: dependency versions, authentication, input handling and configuration.' : '- Review the source repository to assess application logic, dependencies and configuration, none of which are visible from outside.', '');

  /* 8 ----------------------------------------------------------------------------- */
  add('## 8. Conclusion', '');
  const areas = and([...new Set(s.issues.slice(0, 5).map((i) => lower(i.area)))]);
  add(s.high > 0 ? `On the evidence examined, ${code(host)} has ${pl(s.high, 'high-priority issue')} that warrant prompt attention, notably ${and(s.issues.filter((i) => i.severity === 'high').slice(0, 3).map((i) => i.title))}. Resolving these, and then the medium-priority items, would materially improve ${areas}.`
    : s.medium > 0 ? `On the evidence examined, ${code(host)} is in generally sound technical condition, with ${pl(s.medium, 'medium-priority improvement')} recommended, chiefly in ${areas}. None of the findings is critical, but together they represent a worthwhile body of work.`
    : s.low > 0 ? `On the evidence examined, ${code(host)} is in sound technical condition. The ${pl(s.low, 'low-priority item')} recorded are refinements that can be handled in the course of routine maintenance.`
    : `On the evidence examined, no defects were identified in ${code(host)} within the scope of this review.`, '');
  if (narrative) add(`> **Reviewer's closing note** (AI-assisted, ${narrative.provider}):`, '>', ...safeNarrative(narrative.conclusion, 1200).split(/\n+/).map((p) => `> ${p}`), '');
  add('This report is a draft produced by an automated review. It should be read together with the limitations in section 2 before any decision is taken on the basis of it.', '');

  /* Appendices -------------------------------------------------------------------- */
  add('## Appendix A. Evidence', '', '### A.1 Response headers examined', '');
  const hv = (k: string) => (h[k] === undefined ? 'Not present' : code(Array.isArray(h[k]) ? (h[k] as string[]).join('; ') : String(h[k]), 90));
  add('| Header | Value |', '| --- | --- |', ...['server', 'x-powered-by', 'content-type', 'cache-control', 'strict-transport-security', 'content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy'].map((k) => `| ${k} | ${hv(k)} |`), `| content-encoding (compression test) | ${c.compression ? code(c.compression, 20) : 'Not present'} |`, '');
  add('### A.2 Heading outline of the landing page', '');
  if (f.headings.length) f.headings.slice(0, 25).forEach((x) => add(`- h${x.level}: ${code(x.text, 80)}`)); else add('No headings were found.');
  if (f.headings.length > 25) add(`- and ${pl(f.headings.length - 25, 'further heading')}`);
  add('', '### A.3 Navigation', '');
  if (f.nav.length) f.nav.slice(0, 20).forEach((x) => add(`- ${code(x.text, 40)} to ${code(path(x.href), 60)}`)); else add('No navigation items were detected.');
  add('', '### A.4 Third-party hosts', '');
  const hosts = [...new Set([...f.scripts.thirdPartyHosts, ...f.styles.thirdPartyHosts])];
  if (hosts.length) hosts.slice(0, 20).forEach((x) => add(`- ${code(x, 60)}`)); else add('No third-party script or stylesheet hosts were detected.');
  add('', '## Appendix B. Rating scale', '');
  add('| Priority | Meaning |', '| --- | --- |',
    '| High | Likely to cause material harm now, such as a security exposure, content blocked from search or a broken experience. Address first. |',
    '| Medium | A meaningful weakness. Address in the near term. |', '| Low | A minor weakness or refinement. Address as part of routine maintenance. |',
    '| Note | Informational. No action is required unless the context makes it relevant. |', '');
  add('| Result | Meaning |', '| --- | --- |', '| Pass | The check was satisfied on the evidence examined. |', '| Attention | A weakness of medium or low priority was found. |', '| Fail | A high-priority defect was found. |', '| Note | Information recorded without a judgement. |', '');
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
