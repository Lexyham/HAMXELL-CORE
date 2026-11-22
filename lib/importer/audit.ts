import type { SiteCrawl } from './crawl';
import type { RepoFacts } from './github';
import { and, be, code, cell, kb as size, n, path, pl } from './md';

export type Area = 'Content and structure' | 'Search visibility' | 'Accessibility and mobile' | 'Performance' | 'Security' | 'Crawlability' | 'Repository';
export const AREAS: Area[] = ['Content and structure', 'Search visibility', 'Accessibility and mobile', 'Performance', 'Security', 'Crawlability', 'Repository'];
export type Severity = 'high' | 'medium' | 'low' | 'info';
export type Outcome = 'pass' | 'attention' | 'fail' | 'note';

export interface Finding {
  id: string; area: Area; title: string; outcome: Outcome; severity: Severity;
  observation: string; recommendation: string; basis: 'observed' | 'inferred';
}

const mk = (id: string, area: Area, title: string) => ({
  pass: (observation: string): Finding => ({ id, area, title, outcome: 'pass', severity: 'info', observation: cell(observation), recommendation: '', basis: 'observed' }),
  note: (observation: string, recommendation = ''): Finding => ({ id, area, title, outcome: 'note', severity: 'info', observation: cell(observation), recommendation: cell(recommendation), basis: 'observed' }),
  warn: (severity: 'high' | 'medium' | 'low', observation: string, recommendation: string): Finding => ({ id, area, title, outcome: severity === 'high' ? 'fail' : 'attention', severity, observation: cell(observation), recommendation: cell(recommendation), basis: 'observed' }),
});

const CTA = /\b(contact|get started|start|sign ?up|register|book|schedule|request|quote|demo|buy|order|subscribe|download|try|join|enquir|apply|talk to|get in touch)\b/i;

/** Runs every check against a crawl. Pure and deterministic. */
export function runChecks(c: SiteCrawl): Finding[] {
  const f = c.home.facts, h = c.home.headers, out: Finding[] = [];
  const hv = (k: string) => String(h[k] ?? '');
  const https = /^https:/i.test(c.finalUrl);
  const own = new URL(c.finalUrl).hostname;
  const ok = c.pages.filter((p) => p.status > 0 && p.status < 400 && !p.skipped && !p.error);
  const h1s = f.headings.filter((x) => x.level === 1);

  /* ---------------------------- Content and structure ---------------------------- */
  {
    const k = mk('CNT-01', 'Content and structure', 'Content depth');
    out.push(f.words < 150
      ? k.warn('low', `The landing page contained approximately ${n(f.words)} words of visible text, which is thin for a page expected to explain what is offered.`, 'Add a clear explanation of what is offered, who it is for and how to proceed, in plain language.')
      : k.pass(`The landing page contained approximately ${n(f.words)} words of visible text.`));
  }
  {
    const k = mk('CNT-02', 'Content and structure', 'Primary navigation');
    const items = f.nav.length;
    out.push(items === 0 ? k.warn('low', 'No primary navigation menu was detected on the landing page.', 'Provide a clearly marked navigation menu (a nav element) so visitors and assistive technology can find the main sections.')
      : items > 12 ? k.warn('low', `The primary navigation listed ${pl(items, 'item')}, which is more than most visitors can scan comfortably.`, 'Group related items or reduce the menu to the destinations visitors use most.')
      : k.pass(`The primary navigation listed ${pl(items, 'item')}: ${and(f.nav.slice(0, 8).map((x) => code(x.text, 30)))}${items > 8 ? ' and others' : ''}.`));
  }
  {
    const k = mk('CNT-03', 'Content and structure', 'Calls to action');
    const ctas = [...f.buttons, ...f.nav.map((x) => x.text)].filter((t) => CTA.test(t));
    out.push(ctas.length === 0 && f.forms === 0
      ? k.warn('low', 'No clear call to action (a prompt such as contact, book, request or start) was found in the navigation, buttons or forms.', 'State the next step plainly and repeat it where a visitor is likely to decide.')
      : k.pass(ctas.length ? `Calls to action were present, for example ${and([...new Set(ctas)].slice(0, 3).map((t) => code(t, 30)))}.` : `The page offered ${pl(f.forms, 'form')} as its route to action.`));
  }
  {
    const k = mk('CNT-04', 'Content and structure', 'Route to contact');
    const hit = f.nav.some((x) => /contact|enquir|get.?in.?touch|support/i.test(`${x.text} ${x.href}`)) || f.links.internal.some((u) => /contact|enquir|get-in-touch|support/i.test(u)) || f.forms > 0;
    out.push(hit ? k.pass('A route to make contact (a contact link or a form) was present.') : k.warn('low', 'No contact link or form was detected on the landing page.', 'Make it easy to get in touch: link a contact page from the navigation and footer.'));
  }
  {
    const k = mk('CNT-05', 'Content and structure', 'Heading hierarchy');
    let prev = 0, skip = '';
    for (const x of f.headings) { if (prev && x.level > prev + 1 && !skip) skip = `an h${prev} was followed by an h${x.level} (${code(x.text, 50)})`; prev = x.level; }
    out.push(f.headings.length === 0 ? k.warn('medium', 'The landing page contained no headings, so it has no outline for readers or assistive technology.', 'Structure the page with headings, starting with a single h1 and nesting sections beneath it.')
      : skip ? k.warn('low', `Heading levels were skipped: ${skip}.`, 'Keep heading levels sequential so the outline remains meaningful when read out of context.')
      : k.pass(`The page contained ${pl(f.headings.length, 'heading')} in a sequential hierarchy.`));
  }

  /* ------------------------------- Search visibility ------------------------------ */
  {
    const k = mk('SEO-01', 'Search visibility', 'Page title');
    const t = f.title;
    out.push(!t ? k.warn('high', 'The landing page had no title element.', 'Add a unique, descriptive title of roughly 20 to 65 characters that names the organisation and what it does.')
      : t.length < 20 ? k.warn('low', `The title ${code(t, 70)} was ${t.length} characters, which is short for a search result.`, 'Expand the title so it states the organisation and its offer (roughly 20 to 65 characters).')
      : t.length > 65 ? k.warn('low', `The title was ${t.length} characters (${code(t, 70)}); search engines typically truncate titles beyond about 60 characters.`, 'Shorten the title so the important words appear early and are not cut off.')
      : k.pass(`The title was ${t.length} characters: ${code(t, 70)}.`));
  }
  {
    const k = mk('SEO-02', 'Search visibility', 'Meta description');
    const d = f.description;
    out.push(!d ? k.warn('medium', 'The landing page had no meta description, so search engines will compose their own snippet from page text.', 'Write a description of roughly 70 to 160 characters that summarises the page and invites the click.')
      : d.length < 50 ? k.warn('low', `The meta description was only ${d.length} characters (${code(d, 70)}).`, 'Expand the description to roughly 70 to 160 characters.')
      : d.length > 170 ? k.warn('low', `The meta description was ${d.length} characters and is likely to be truncated in search results.`, 'Tighten the description to roughly 160 characters or fewer.')
      : k.pass(`The meta description was ${d.length} characters.`));
  }
  {
    const k = mk('SEO-03', 'Search visibility', 'Canonical address');
    let differs = false; try { differs = !!f.canonical && new URL(f.canonical).hostname.replace(/^www\./, '') !== own.replace(/^www\./, ''); } catch { /* ignore */ }
    out.push(!f.canonical ? k.warn('low', 'No canonical link was declared, so search engines must infer the preferred address when several URLs show the same content.', 'Declare a canonical link on each page pointing to its preferred address.')
      : differs ? k.warn('medium', `The canonical link pointed to a different host (${code(f.canonical)}).`, 'Confirm this is intended; otherwise point the canonical link at this site.')
      : k.pass(`A canonical link was declared: ${code(f.canonical)}.`));
  }
  {
    const k = mk('SEO-04', 'Search visibility', 'Main heading (h1)');
    out.push(h1s.length === 0 ? k.warn('medium', 'The landing page had no h1 heading.', 'Provide one h1 that states the page\u2019s subject.')
      : h1s.length > 1 ? k.warn('low', `The landing page had ${h1s.length} h1 headings.`, 'Use a single h1 for the main subject and h2 or lower for sections.')
      : k.pass(`The page had a single h1: ${code(h1s[0].text, 70)}.`));
  }
  {
    const k = mk('SEO-05', 'Search visibility', 'Link previews (Open Graph)');
    const missing = ['og:title', 'og:description', 'og:image'].filter((x) => !f.og[x]);
    out.push(missing.length === 3 ? k.warn('low', 'No Open Graph tags were found, so links shared on social platforms and messaging apps will show a plain, unbranded preview.', 'Add og:title, og:description and og:image (at least 1200 by 630 pixels) to each shareable page.')
      : missing.length ? k.warn('low', `Open Graph tags were partly present; ${and(missing.map((x) => code(x)))} ${missing.length === 1 ? 'was' : 'were'} missing.`, `Add the missing ${missing.length === 1 ? 'tag' : 'tags'} so previews are complete.`)
      : k.pass('The Open Graph title, description and image were all declared.'));
  }
  {
    const k = mk('SEO-06', 'Search visibility', 'Twitter / X card');
    out.push(f.twitter['twitter:card'] ? k.pass(`A card type was declared: ${code(f.twitter['twitter:card'], 40)}.`) : k.note('No twitter:card tag was found; previews on that platform fall back to Open Graph data where available.', 'Add a twitter:card tag (for example summary_large_image) if previews on X matter to the organisation.'));
  }
  {
    const k = mk('SEO-07', 'Search visibility', 'Indexability');
    const noindex = /noindex/.test(f.robotsMeta) || /noindex/i.test(hv('x-robots-tag'));
    out.push(noindex ? k.warn('high', 'The landing page carried a noindex directive, which asks search engines to leave it out of their results.', 'Confirm that this is intended. Public pages that should be found in search must not carry noindex, either in a meta tag or in the X-Robots-Tag header.')
      : k.pass('No directive excluding the landing page from search results was found.'));
  }
  {
    const k = mk('SEO-08', 'Search visibility', 'Structured data');
    out.push(f.jsonLd > 0 ? k.pass(`Structured data was present in ${pl(f.jsonLd, 'JSON-LD block')}.`) : k.note('No JSON-LD structured data was detected.', 'Consider Organization and WebSite markup so search engines can show richer, more accurate results.'));
  }
  {
    const k = mk('SEO-09', 'Search visibility', 'Declared language');
    out.push(f.lang ? k.pass(`The document language was declared as ${code(f.lang, 20)}.`) : k.warn('medium', 'The html element declared no language.', 'Add a lang attribute (for example lang="en") so search engines, translation tools and screen readers use the correct language.'));
  }
  {
    const k = mk('SEO-10', 'Search visibility', 'Site icon');
    out.push(f.favicon ? k.pass(`A site icon was declared: ${code(f.favicon)}.`) : k.warn('low', 'No site icon was declared in the page head.', 'Declare an icon so browsers, bookmarks and search results can show the brand.'));
  }

  /* ------------------------------ Accessibility and mobile ------------------------------ */
  {
    const k = mk('ACC-01', 'Accessibility and mobile', 'Mobile viewport');
    out.push(!f.viewport ? k.warn('high', 'No viewport meta tag was present, so phones will render the page at desktop width and shrink it.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.')
      : !/width\s*=\s*device-width/i.test(f.viewport) ? k.warn('medium', `The viewport declaration (${code(f.viewport, 70)}) did not set the width to the device width.`, 'Use width=device-width so the layout adapts to the screen.')
      : k.pass(`The viewport was declared as ${code(f.viewport, 70)}.`));
  }
  {
    const k = mk('ACC-02', 'Accessibility and mobile', 'Pinch zoom');
    const max = f.viewport.match(/maximum-scale\s*=\s*([\d.]+)/i)?.[1];
    const blocked = /user-scalable\s*=\s*(no|0)/i.test(f.viewport) || (max !== undefined && Number(max) < 2);
    out.push(blocked ? k.warn('medium', `The viewport settings (${code(f.viewport, 70)}) restrict zooming, which prevents people with low vision from enlarging the page.`, 'Remove user-scalable=no and any maximum-scale below 2.') : k.pass('The viewport did not restrict zooming.'));
  }
  {
    const k = mk('ACC-03', 'Accessibility and mobile', 'Image text alternatives');
    const { total, missingAlt } = f.images;
    out.push(missingAlt > 0 ? k.warn('medium', `The landing page had ${pl(total, 'image')}, ${n(missingAlt)} of which had no alt attribute.`, 'Give every informative image a short alt description, and an empty alt for purely decorative images.')
      : k.pass(total ? `All ${pl(total, 'image')} carried an alt attribute.` : 'The landing page contained no images.'));
  }
  {
    const k = mk('ACC-04', 'Accessibility and mobile', 'Form field labels');
    const { total, unlabelled } = f.controls;
    out.push(unlabelled > 0 ? k.warn('medium', `Of ${pl(total, 'form field')} on the landing page, ${n(unlabelled)} had no programmatic label (a label element, aria-label or title). Placeholder text alone is not a label.`, 'Associate a visible label with every field using a label element and matching for and id attributes.')
      : k.pass(total ? `All ${pl(total, 'form field')} had an accessible label.` : 'The landing page contained no form fields.'));
  }
  {
    const k = mk('ACC-05', 'Accessibility and mobile', 'Links and buttons with no name');
    const bad = f.links.unnamed + f.unnamedButtons;
    out.push(bad > 0 ? k.warn('medium', `The landing page contained ${pl(f.links.unnamed, 'link')} and ${pl(f.unnamedButtons, 'button')} with no text or accessible name, so screen readers announce them without purpose.`, 'Give each link and button visible text or an aria-label that describes its destination or action.')
      : k.pass('Every link and button had text or an accessible name.'));
  }
  {
    const k = mk('ACC-06', 'Accessibility and mobile', 'Page landmarks');
    const present = (['main', 'nav', 'header', 'footer'] as const).filter((x) => f.landmarks[x]);
    out.push(!f.landmarks.main ? k.warn('low', `No main landmark was found (landmarks present: ${present.length ? and(present.map((x) => code(x))) : 'none'}).`, 'Wrap the primary content in a main element so keyboard and screen-reader users can jump to it.')
      : k.pass(`Landmarks present: ${and(present.map((x) => code(x)))}.`));
  }
  {
    const k = mk('ACC-07', 'Accessibility and mobile', 'Skip link');
    out.push(f.skipLink ? k.pass('A skip-to-content link was present near the start of the page.') : k.note('No skip-to-content link was found near the start of the page.', f.nav.length > 5 ? 'With a long navigation menu, a skip link lets keyboard users bypass it on every page.' : ''));
  }

  /* ---------------------------------- Performance ---------------------------------- */
    {
    const k = mk('PERF-01', 'Performance', 'HTML document size');
    out.push(f.bytes > 1_048_576 ? k.warn('high', `The landing page HTML was ${size(f.bytes)} before compression, which is very large for a document that must be downloaded before anything renders.`, 'Reduce inline data and repeated markup, and load secondary content on demand.')
      : f.bytes > 307_200 ? k.warn('medium', `The landing page HTML was ${size(f.bytes)} before compression.`, 'Review inline scripts, styles and repeated markup that could be moved to cacheable files.')
      : f.bytes > 122_880 ? k.warn('low', `The landing page HTML was ${size(f.bytes)} before compression.`, 'Keep an eye on document growth; consider moving inline assets to cacheable files.')
      : k.pass(`The landing page HTML was ${size(f.bytes)} before compression.`));
  }
  {
    const k = mk('PERF-02', 'Performance', 'Transfer compression');
    out.push(c.compression ? k.pass(`The server compressed the response using ${code(c.compression, 20)}.`)
      : f.bytes > 2048 ? k.warn('medium', 'The server returned the landing page uncompressed when compression was requested.', 'Enable Brotli or gzip compression for HTML, CSS, JavaScript and other text responses.')
      : k.pass('The document was too small for compression to matter.'));
  }
  {
    const k = mk('PERF-03', 'Performance', 'Server response time');
    const ms = c.home.ms;
    out.push(ms > 2000 ? k.warn('medium', `The landing page took ${n(ms)} ms to download in this review, which is slow (single measurement from the reviewing server).`, 'Investigate server processing time, database queries and caching for the home page.')
      : ms > 1000 ? k.warn('low', `The landing page took ${n(ms)} ms to download in this review (single measurement from the reviewing server).`, 'Consider caching the page at the edge or reducing server-side work.')
      : k.pass(`The landing page downloaded in ${n(ms)} ms (single measurement from the reviewing server).`));
  }
  {
    const k = mk('PERF-04', 'Performance', 'Render-blocking scripts');
    const b = f.scripts.blocking;
    out.push(b >= 3 ? k.warn('medium', `In the document head, ${pl(b, 'script')} ${be(b)} loaded without async or defer, which delays first paint.`, 'Add defer (or async where order does not matter) to scripts in the head, or move them to the end of the body.')
      : b > 0 ? k.warn('low', `In the document head, ${pl(b, 'script')} ${be(b)} loaded without async or defer.`, 'Add defer to head scripts that do not need to run before the page renders.')
      : k.pass('No render-blocking scripts were found in the document head.'));
  }
  {
    const k = mk('PERF-05', 'Performance', 'Script volume');
    const e = f.scripts.external;
    out.push(e > 15 ? k.warn('medium', `The landing page loaded ${pl(e, 'external script')} and ${pl(f.scripts.inline, 'inline script')}.`, 'Audit scripts for necessity and consolidate or remove those that do not earn their cost.')
      : e > 8 ? k.warn('low', `The landing page loaded ${pl(e, 'external script')}.`, 'Check that each script is needed on the landing page.')
      : k.pass(`The landing page loaded ${pl(e, 'external script')} and ${pl(f.scripts.inline, 'inline script')}.`));
  }
  {
    const k = mk('PERF-06', 'Performance', 'Third-party dependencies');
    const hosts = [...new Set([...f.scripts.thirdPartyHosts, ...f.styles.thirdPartyHosts])];
    out.push(hosts.length > 8 ? k.warn('medium', `Scripts and stylesheets were loaded from ${pl(hosts.length, 'third-party host')}, including ${and(hosts.slice(0, 5).map((x) => code(x, 40)))}.`, 'Each third-party host adds connection time and a point of failure; remove those that are not essential.')
      : hosts.length > 5 ? k.warn('low', `Scripts and stylesheets were loaded from ${pl(hosts.length, 'third-party host')}: ${and(hosts.map((x) => code(x, 40)))}.`, 'Review whether each third-party service is still required.')
      : k.pass(hosts.length ? `Scripts and stylesheets came from ${pl(hosts.length, 'third-party host')}: ${and(hosts.map((x) => code(x, 40)))}.` : 'No third-party script or stylesheet hosts were detected.'));
  }
  {
    const k = mk('PERF-07', 'Performance', 'Image dimensions');
    out.push(f.images.total > 0 && f.images.noDimensions > 0 ? k.warn('low', `Of ${pl(f.images.total, 'image')}, ${n(f.images.noDimensions)} had no width and height attributes, which can cause the layout to shift as images load.`, 'Declare width and height on images (or reserve space with CSS aspect-ratio) to avoid layout shift.')
      : k.pass(f.images.total ? 'All images declared their dimensions.' : 'The landing page contained no images.'));
  }
  {
    const k = mk('PERF-08', 'Performance', 'Lazy loading');
    out.push(f.images.total >= 6 && f.images.lazy === 0 ? k.warn('low', `The page contained ${pl(f.images.total, 'image')} and none used lazy loading.`, 'Add loading="lazy" to images below the first screen so they do not compete with content that is visible immediately.')
      : k.pass(f.images.total >= 6 ? `Of ${pl(f.images.total, 'image')}, ${n(f.images.lazy)} used lazy loading.` : 'The page contained too few images for lazy loading to matter.'));
  }
  {
    const k = mk('PERF-09', 'Performance', 'Stylesheets');
    out.push(f.styles.external > 6 ? k.warn('low', `The landing page requested ${pl(f.styles.external, 'external stylesheet')}.`, 'Combine stylesheets where practical; each is a separate request that blocks rendering.') : k.pass(`The landing page requested ${pl(f.styles.external, 'external stylesheet')} and used ${pl(f.styles.inline, 'inline style block')}.`));
  }
  {
    const k = mk('PERF-10', 'Performance', 'Caching policy for the page');
    const cc = hv('cache-control');
    out.push(k.note(cc ? `The page was served with Cache-Control ${code(cc, 80)}.` : 'The page was served without a Cache-Control header.', cc ? '' : 'State a caching policy explicitly so browsers and CDNs behave predictably.'));
  }

  /* ------------------------------------- Security ------------------------------------- */
  {
    const k = mk('SEC-01', 'Security', 'Encrypted connection (HTTPS)');
    out.push(https ? k.pass('The landing page was served over HTTPS.') : k.warn('high', 'The landing page was served over unencrypted HTTP.', 'Serve the entire site over HTTPS, redirect all HTTP requests to it, and enable HSTS.'));
  }
  {
    const k = mk('SEC-02', 'Security', 'Mixed content');
    out.push(!https ? k.note('Mixed content could not be assessed because the page was not served over HTTPS.') : f.mixedContent.length ? k.warn('high', `On the HTTPS page, ${pl(f.mixedContent.length, 'resource')} ${be(f.mixedContent.length)} requested over HTTP, for example ${code(f.mixedContent[0], 80)}.`, 'Load every resource over HTTPS; browsers block or warn about insecure subresources.') : k.pass('No insecure (HTTP) subresources were referenced on the HTTPS page.'));
  }
  {
    const k = mk('SEC-03', 'Security', 'Strict-Transport-Security (HSTS)');
    const v = hv('strict-transport-security');
    out.push(!https ? k.note('HSTS applies only to HTTPS responses.') : v ? k.pass(`HSTS was set: ${code(v, 80)}.`) : k.warn('medium', 'The response carried no Strict-Transport-Security header, so browsers are not told to insist on HTTPS for future visits.', 'Send Strict-Transport-Security with a max-age of at least one year once HTTPS is fully in place.'));
  }
  {
    const k = mk('SEC-04', 'Security', 'Content-Security-Policy');
    out.push(hv('content-security-policy') ? k.pass('A Content-Security-Policy header was present.') : k.warn('medium', 'The response carried no Content-Security-Policy header, which limits the damage a cross-site scripting flaw could do.', 'Introduce a Content-Security-Policy, starting in report-only mode and tightening it as violations are resolved.'));
  }
  {
    const k = mk('SEC-05', 'Security', 'MIME sniffing protection');
    out.push(/nosniff/i.test(hv('x-content-type-options')) ? k.pass('X-Content-Type-Options: nosniff was set.') : k.warn('low', 'X-Content-Type-Options: nosniff was not set.', 'Send X-Content-Type-Options: nosniff to stop browsers guessing content types.'));
  }
  {
    const k = mk('SEC-06', 'Security', 'Clickjacking protection');
    out.push(hv('x-frame-options') || /frame-ancestors/i.test(hv('content-security-policy')) ? k.pass('The page restricted framing (X-Frame-Options or CSP frame-ancestors).') : k.warn('low', 'Neither X-Frame-Options nor a CSP frame-ancestors directive was present, so other sites may embed the page in a frame.', 'Send a frame-ancestors directive (or X-Frame-Options: DENY) unless embedding is intended.'));
  }
  {
    const k = mk('SEC-07', 'Security', 'Referrer-Policy');
    out.push(hv('referrer-policy') ? k.pass(`Referrer-Policy was set: ${code(hv('referrer-policy'), 60)}.`) : k.warn('low', 'No Referrer-Policy header was present.', 'Send Referrer-Policy: strict-origin-when-cross-origin (or stricter) to limit what is shared with other sites.'));
  }
  {
    const k = mk('SEC-08', 'Security', 'Permissions-Policy');
    out.push(hv('permissions-policy') ? k.pass('A Permissions-Policy header was present.') : k.note('No Permissions-Policy header was present.', 'Consider disabling browser features the site does not use (camera, microphone, geolocation).'));
  }
  {
    const k = mk('SEC-09', 'Security', 'Technology disclosure in headers');
    const server = hv('server'), powered = hv('x-powered-by');
    const versioned = /\d+\.\d+/.test(server);
    out.push(powered || versioned ? k.warn('low', `Response headers disclosed implementation details (${[server && `Server: ${code(server, 40)}`, powered && `X-Powered-By: ${code(powered, 40)}`].filter(Boolean).join(', ')}).`, 'Remove X-Powered-By and version numbers from the Server header; they help attackers target known flaws.')
      : k.pass('The response headers did not disclose version-specific technology details.'));
  }
  {
    const k = mk('SEC-10', 'Security', 'Cookie attributes');
    const raw = h['set-cookie']; const cookies = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
    const weak = cookies.filter((ck) => (https && !/;\s*secure/i.test(ck)) || !/;\s*httponly/i.test(ck) || !/;\s*samesite/i.test(ck));
    out.push(cookies.length === 0 ? k.pass('The landing page set no cookies.')
      : weak.length ? k.warn('medium', `Of ${pl(cookies.length, 'cookie')} set, ${n(weak.length)} lacked one or more of the Secure, HttpOnly and SameSite attributes (for example ${code(weak[0].split('=')[0], 30)}).`, 'Set Secure, HttpOnly and an appropriate SameSite value on every cookie that does not need to be read by scripts.')
      : k.pass(`The ${pl(cookies.length, 'cookie')} set carried Secure, HttpOnly and SameSite attributes.`));
  }

  /* ----------------------------------- Crawlability ----------------------------------- */
  {
    const k = mk('CRL-01', 'Crawlability', 'robots.txt');
    out.push(c.robots.disallowsAll ? k.warn('high', 'robots.txt told all crawlers not to visit any page of the site.', 'Remove the blanket Disallow: / rule unless the site is intentionally hidden from search engines.')
      : c.robots.present ? k.pass(`A robots.txt file was present and did not block the site${c.robots.sitemaps.length ? `; it declared ${pl(c.robots.sitemaps.length, 'sitemap')}` : ''}.`)
      : c.robots.status === null ? k.note('robots.txt could not be retrieved.', '')
      : k.warn('low', `No robots.txt file was found (the server answered HTTP ${c.robots.status}).`, 'Publish a robots.txt that allows crawling and points to the sitemap.'));
  }
  {
    const k = mk('CRL-02', 'Crawlability', 'XML sitemap');
    out.push(c.sitemap.urls > 0 ? k.pass(`A sitemap${c.sitemap.isIndex ? ' index' : ''} was found at ${code(path(c.sitemap.url), 60)} listing ${pl(c.sitemap.urls, c.sitemap.isIndex ? 'entry' : 'address', c.sitemap.isIndex ? 'entries' : 'addresses')}.`)
      : k.warn('low', `No usable XML sitemap was found at ${code(path(c.sitemap.url), 60)}.`, 'Publish a sitemap listing every public page and reference it from robots.txt.'));
  }
  {
    const k = mk('CRL-03', 'Crawlability', 'Internal link health');
    const broken = [...c.pages.filter((p) => !p.skipped && (p.status >= 400 || p.status === 0)).map((p) => ({ url: p.url, status: p.status })), ...c.linkChecks.filter((l) => l.status >= 400 || l.status === 0)];
    const checked = c.pages.filter((p) => !p.skipped).length - 1 + c.linkChecks.length;
    out.push(broken.length >= 3 ? k.warn('high', `Of ${pl(checked, 'internal link')} checked, ${n(broken.length)} ${be(broken.length)} broken or unreachable, including ${and(broken.slice(0, 4).map((b) => `${code(path(b.url), 50)} (${b.status || 'no response'})`))}.`, 'Fix or remove broken links; they frustrate visitors and waste crawl budget.')
      : broken.length ? k.warn('medium', `Of ${pl(checked, 'internal link')} checked, ${n(broken.length)} ${be(broken.length)} broken or unreachable: ${and(broken.map((b) => `${code(path(b.url), 50)} (${b.status || 'no response'})`))}.`, 'Fix or remove the broken links.')
      : k.pass(checked ? `All ${pl(checked, 'internal link')} checked responded successfully.` : 'No further internal links were found to check.'));
  }
  {
    const k = mk('CRL-04', 'Crawlability', 'Duplicate page titles');
    const seen = new Map<string, number>();
    for (const p of ok) if (p.title) seen.set(p.title, (seen.get(p.title) ?? 0) + 1);
    const dup = [...seen.entries()].filter(([, v]) => v > 1);
    out.push(dup.length ? k.warn('medium', `Some titles were shared by more than one reviewed page, for example ${code(dup[0][0], 60)} (${dup[0][1]} pages).`, 'Give every page a unique title so search engines and visitors can tell them apart.')
      : k.pass(ok.length > 1 ? 'Every reviewed page had a distinct title.' : 'Only one page was reviewed, so title uniqueness could not be compared.'));
  }
  {
    const k = mk('CRL-05', 'Crawlability', 'Metadata coverage across reviewed pages');
    const noTitle = ok.filter((p) => !p.title).length, noDesc = ok.filter((p) => !p.description).length, noH1 = ok.filter((p) => p.h1 === 0).length;
    const parts = [noTitle && `${pl(noTitle, 'page')} without a title`, noDesc && `${pl(noDesc, 'page')} without a meta description`, noH1 && `${pl(noH1, 'page')} without an h1`].filter(Boolean) as string[];
    out.push(parts.length ? k.warn(noTitle || noH1 ? 'medium' : 'low', `Of ${pl(ok.length, 'reviewed page')}, ${and(parts)}.`, 'Apply a template that requires a title, description and h1 on every page.') : k.pass(`All ${pl(ok.length, 'reviewed page')} had a title, a meta description and an h1.`));
  }
  {
    const k = mk('CRL-06', 'Crawlability', 'Indexability of reviewed pages');
    const ni = ok.filter((p) => p.noindex && p.url !== c.pages[0].url);
    out.push(ni.length ? k.warn('medium', `The following reviewed pages carried a noindex directive: ${and(ni.slice(0, 4).map((p) => code(path(p.url), 50)))}.`, 'Confirm each is intentionally excluded from search results.') : k.pass('No reviewed page, other than any noted above, was excluded from search results.'));
  }
  {
    const k = mk('CRL-07', 'Crawlability', 'Review coverage');
    const reviewed = c.pages.filter((p) => !p.skipped && !p.error).length;
    out.push(k.note(`In all, ${pl(reviewed, 'page')} ${be(reviewed)} reviewed in full and ${pl(c.linkChecks.length, 'further link')} ${be(c.linkChecks.length)} status-checked, out of ${pl(c.internalLinksFound + 1, 'internal address', 'internal addresses')} discovered from the landing page.${c.truncatedCrawl ? ' The review stopped early because it reached its time limit.' : ''}`, 'Findings about page-level matters describe only the pages reviewed; a review of the full site would extend them.'));
  }
  if (c.redirected) {
    const k = mk('CRL-08', 'Crawlability', 'Address redirection');
    out.push(k.note(`The requested address ${code(c.sourceUrl, 80)} redirected to ${code(c.finalUrl, 80)}.`, 'Redirects are normal (for example from http to https, or to the preferred host); keep them to a single hop.'));
  }
  return out;
}

export const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };
export const PRIORITY_LABEL: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low', info: 'Note' };
export const OUTCOME_LABEL: Record<Outcome, string> = { pass: 'Pass', attention: 'Attention', fail: 'Fail', note: 'Note' };

/** Checks on a public repository, from its metadata and root file listing only. Names are matched, contents are never read. */
export function runRepoChecks(r: RepoFacts, now = Date.now()): Finding[] {
  const out: Finding[] = [];
  const has = (re: RegExp) => r.rootFiles.some((f) => re.test(f.name));
  const file = (re: RegExp) => r.rootFiles.find((f) => re.test(f.name));
  const days = Math.max(0, Math.floor((now - Date.parse(r.pushedAt)) / 864e5));
  {
    const k = mk('REP-01', 'Repository', 'README');
    const rd = file(/^readme(\.|$)/i);
    out.push(!rd ? k.warn('medium', 'The repository root contained no README file.', 'Add a README that says what the project is, how to run it and how to contribute.')
      : rd.size < 300 ? k.warn('low', `The README (${code(rd.name, 30)}) was only ${n(rd.size)} bytes, which is too short to orient a newcomer.`, 'Expand the README: purpose, setup, configuration and how to run the tests.')
      : k.pass(`A README was present (${code(rd.name, 30)}, ${n(rd.size)} bytes).`));
  }
  {
    const k = mk('REP-02', 'Repository', 'Licence');
    out.push(r.license ? k.pass(`The repository declared the licence ${code(r.license, 30)}.`) : k.warn('medium', 'No licence was declared. Without one, other people have no legal permission to use, change or share the code.', 'Add a LICENSE file that states the terms under which the code may be used.'));
  }
  {
    const k = mk('REP-03', 'Repository', 'Recent activity');
    out.push(r.archived ? k.note('The repository was archived, so it is read-only and is not expected to change.')
      : days > 540 ? k.warn('medium', `The last push was about ${n(Math.round(days / 30))} months ago.`, 'If the project is still in use, review dependencies for security updates; if not, archive the repository to say so.')
      : days > 180 ? k.warn('low', `The last push was about ${n(Math.round(days / 30))} months ago.`, 'Check whether dependencies need updating.')
      : k.pass(`The last push was ${days === 0 ? 'today' : `${pl(days, 'day')} ago`}.`));
  }
  {
    const k = mk('REP-04', 'Repository', 'Automated checks (CI)');
    const ci = has(/^\.github$/i) || has(/^\.gitlab-ci\.yml$/i) || has(/^\.circleci$/i) || has(/^azure-pipelines\.yml$/i);
    out.push({ ...(ci ? k.pass('A CI configuration location was present at the repository root.') : k.warn('low', 'No continuous-integration configuration was found at the repository root.', 'Run tests and linting automatically on every change, for example with GitHub Actions.')), basis: 'inferred' });
  }
  {
    const k = mk('REP-05', 'Repository', 'Automated tests');
    const t = has(/^(tests?|__tests__|spec|e2e|cypress)$/i) || has(/^(jest|vitest|playwright|cypress)\.config\./i) || has(/^(pytest\.ini|tox\.ini|phpunit\.xml)$/i);
    out.push({ ...(t ? k.pass('Test directories or test-runner configuration were present at the repository root.') : k.warn('low', 'No test directory or test-runner configuration was found at the repository root.', 'Add automated tests for the behaviour the project depends on.')), basis: 'inferred' });
  }
  {
    const k = mk('REP-06', 'Repository', 'Dependency management');
    const manifest = file(/^(package\.json|requirements\.txt|pyproject\.toml|composer\.json|go\.mod|cargo\.toml|gemfile|pom\.xml)$/i);
    const lock = has(/^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|poetry\.lock|composer\.lock|go\.sum|cargo\.lock|gemfile\.lock)$/i);
    out.push(!manifest ? k.note('No common dependency manifest was found at the repository root.')
      : lock ? k.pass(`A dependency manifest (${code(manifest.name, 30)}) and a lockfile were present, so installs are reproducible.`)
      : k.warn('low', `A dependency manifest (${code(manifest.name, 30)}) was present without a lockfile, so installs may differ between machines and over time.`, 'Commit the lockfile so every install resolves the same versions.'));
  }
  {
    const k = mk('REP-07', 'Repository', 'Files that commonly hold secrets');
    const risky = r.rootFiles.filter((f) => f.type === 'file' && /^(\.env(\.(local|production|prod|development))?|id_rsa|id_ed25519|credentials\.json|serviceaccount.*\.json|.*\.(pem|p12|pfx|key))$/i.test(f.name));
    out.push(risky.length ? k.warn('high', `Files that commonly hold secrets were present at the repository root: ${and(risky.slice(0, 5).map((f) => code(f.name, 40)))}.`, 'Remove them from the repository and its history, rotate any credentials they contained, and add them to .gitignore. Keep an example file with names only.')
      : k.pass('No files that commonly hold secrets were present at the repository root.'));
  }
  {
    const k = mk('REP-08', 'Repository', 'Security policy');
    out.push(has(/^security\.md$/i) || has(/^\.github$/i) ? k.pass('A security policy, or a .github directory that may hold one, was present.') : k.note('No SECURITY.md was found.', 'Say how vulnerabilities should be reported.'));
  }
  {
    const k = mk('REP-09', 'Repository', 'Contribution guidance');
    out.push(has(/^contributing(\.|$)/i) ? k.pass('Contribution guidance was present.') : k.note('No CONTRIBUTING file was found.', 'If outside contributions are welcome, explain how to propose changes.'));
  }
  {
    const k = mk('REP-10', 'Repository', 'Deployment configuration');
    const d = r.rootFiles.filter((f) => /^(dockerfile|docker-compose\.ya?ml|procfile|vercel\.json|netlify\.toml|fly\.toml|render\.yaml|app\.ya?ml|serverless\.ya?ml)$/i.test(f.name));
    out.push({ ...k.note(d.length ? `Deployment configuration was present: ${and(d.map((f) => code(f.name, 30)))}.` : 'No deployment configuration (such as a Dockerfile or Procfile) was found at the repository root.'), basis: 'inferred' });
  }
  {
    const k = mk('REP-11', 'Repository', 'Languages');
    out.push(k.note(r.languages.length ? `The repository was written mainly in ${and(r.languages.slice(0, 4).map((l) => `${code(l.name, 24)} (${l.pct}%)`))}.` : 'GitHub reported no language breakdown.'));
  }
  return out;
}
