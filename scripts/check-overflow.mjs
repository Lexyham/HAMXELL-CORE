/**
 * 320px regression test: no horizontal overflow on any page at any common width.
 *
 * Usage (start the site first, for example `npm start` in another terminal):
 *   npx playwright install chromium        (once)
 *   npm run test:overflow
 *   BASE_URL=https://your-site ROUTES=/,/products npm run test:overflow
 *
 * Reduced motion is emulated so the intro is skipped and every reveal is visible. The chat panel is opened and checked too.
 */
import { chromium } from 'playwright';
import { findOverflow } from './overflow-check.mjs';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const ROUTES = (process.env.ROUTES ?? '/,/products,/experiments,/labs,/docs,/about,/contact,/licenses,/admin/login,/no-such-page').split(',');
const WIDTHS = (process.env.WIDTHS ?? '320,360,390,768,1024,1440').split(',').map(Number);

const browser = await chromium.launch();
let failures = 0;
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const problems = [];
    try {
      const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      if (!res) problems.push('no response');
      let r = await findOverflow(page);
      for (const o of r.offenders) problems.push(`overflows: ${o.el} (right edge ${o.right}px, viewport ${r.vw}px)`);

      const launcher = page.locator('button[aria-label="Open assistant"]');
      if (await launcher.count()) {
        await launcher.click({ timeout: 3000 }).catch(() => {});
        const panel = page.locator('[role="dialog"][aria-label="HAMXELL CORE assistant"]');
        if (await panel.count()) {
          const box = await panel.boundingBox();
          if (box && (box.x < -1 || box.x + box.width > width + 1 || box.y < -1 || box.y + box.height > 800 + 1)) problems.push(`chat panel outside the screen (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)})`);
          r = await findOverflow(page);
          for (const o of r.offenders) problems.push(`chat open, overflows: ${o.el} (right edge ${o.right}px)`);
        }
      }
    } catch (e) {
      problems.push(`error: ${e.message.split('\n')[0]}`);
    }
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${String(width).padStart(4)}px ${route}`);
    for (const p of problems) console.log(`       ${p}`);
    failures += problems.length ? 1 : 0;
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} page/width combination(s) failed.` : '\nNo horizontal overflow at any tested width.');
process.exit(failures ? 1 : 0);
