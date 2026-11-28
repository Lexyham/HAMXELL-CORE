import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const browser = await chromium.launch();

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const intro = page.locator('.intro-gate');
  await intro.waitFor({ state: 'visible', timeout: 5000 });
  const gate = await intro.evaluate((el) => getComputedStyle(el));
  assert.equal(gate.backgroundColor, 'rgb(0, 0, 0)', 'intro covers the viewport with an opaque background');
  assert.equal(gate.pointerEvents, 'auto', 'intro intercepts pointer interaction');
  assert.equal(await page.locator('#intro-content').evaluate((el) => el.inert && el.getAttribute('aria-hidden') === 'true'), true, 'the site is inert and hidden from assistive technology');
  assert.equal(await page.evaluate(() => document.elementFromPoint(0, 100)?.closest('.intro-gate') !== null), true, 'the opaque intro covers the viewport edge');
  await page.keyboard.press('Tab');
  assert.equal(await intro.getByRole('button', { name: 'Skip introduction' }).evaluate((el) => el === document.activeElement), true, 'keyboard focus enters the intro instead of the hidden site');
  await page.waitForFunction(() => document.documentElement.classList.contains('lenis'), { timeout: 5000 });
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('lenis-stopped')), true, 'Lenis initializes and remains stopped during the intro');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY), 'hidden', 'background scrolling is locked during the intro');
  await context.close();

  const keyboardContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const keyboardPage = await keyboardContext.newPage();
  await keyboardPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const keyboardIntro = keyboardPage.locator('.intro-gate');
  await keyboardIntro.waitFor({ state: 'visible', timeout: 5000 });
  await keyboardPage.waitForFunction(() => document.documentElement.classList.contains('lenis'), { timeout: 10000 });
  await keyboardIntro.getByRole('button', { name: 'Skip introduction' }).focus();
  await keyboardPage.waitForTimeout(500);
  await keyboardPage.keyboard.press('Escape');
  await keyboardIntro.waitFor({ state: 'detached', timeout: 2000 });
  assert.equal(await keyboardPage.locator('#main').evaluate((el) => el === document.activeElement), true, 'Escape restores focus to main content');

  const reducedContext = await browser.newContext({ reducedMotion: 'reduce' });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await reducedPage.waitForFunction(() => document.querySelector('#intro-content')?.inert === false, { timeout: 5000 });
  assert.equal(await reducedPage.locator('.intro-gate').count(), 0, 'reduced-motion preference skips the intro');
  assert.equal(await reducedPage.locator('section[aria-labelledby="hero-h"] [data-reveal]').first().evaluate((el) => getComputedStyle(el).opacity), '1', 'reduced-motion reveals are visible');
  assert.equal(await reducedPage.locator('#intro-content').evaluate((el) => !el.inert && el.getAttribute('aria-hidden') !== 'true'), true, 'reduced-motion completion restores the site');

  await keyboardContext.close();
  await reducedContext.close();

  const sequenceContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const sequencePage = await sequenceContext.newPage();
  const browserErrors = [];
  sequencePage.on('pageerror', (error) => browserErrors.push(error.message));
  sequencePage.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  await sequencePage.addInitScript(() => {
    sessionStorage.removeItem('hamxell-intro-seen');
    window.__introTestStart = performance.now();
  });
  await sequencePage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const sequenceIntro = sequencePage.locator('.intro-gate');
  await sequenceIntro.waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await sequenceIntro.getAttribute('data-phase'), 'playing', 'the original SVG sequence starts');
  assert.equal(await sequencePage.locator('#intro-content').evaluate((el) => el.inert && el.getAttribute('aria-hidden') === 'true'), true, 'the site remains concealed while the intro plays');
  assert.equal(await sequencePage.locator('header').evaluate((el) => getComputedStyle(el).opacity), '0', 'the navbar entrance waits for intro completion');
  assert.notEqual(await sequencePage.evaluate(() => getComputedStyle(document.body).cursor), 'none', 'the native cursor stays visible before the custom cursor activates');
  await sequencePage.waitForFunction(() => document.documentElement.classList.contains('lenis'), { timeout: 5000 });
  const desktopSmoothScroll = await sequencePage.evaluate(() => document.documentElement.classList.contains('lenis-stopped'));
  assert.equal(desktopSmoothScroll, true, 'desktop Lenis remains initialized and paused during the intro');
  await sequenceIntro.waitFor({ state: 'detached', timeout: 12000 });
  const sequenceDuration = await sequencePage.evaluate(() => performance.now() - window.__introTestStart);
  assert.ok(sequenceDuration >= 8000 && sequenceDuration < 11000, `the SVG sequence should last about 8.2 seconds (observed ${Math.round(sequenceDuration)}ms)`);
  await sequencePage.waitForTimeout(1800);
  assert.equal(await sequencePage.locator('#intro-content').evaluate((el) => !el.inert && el.getAttribute('aria-hidden') !== 'true'), true, 'normal completion restores the site');
  assert.equal(await sequencePage.locator('[data-intro-ready]').count(), 0, 'intro-dependent reveals start after completion');
  assert.equal(await sequencePage.locator('header').evaluate((el) => getComputedStyle(el).opacity), '1', 'navbar entrance completes after the intro');
  const heroOpacity = await sequencePage.locator('section[aria-labelledby="hero-h"] [data-reveal]').evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
  assert.ok(heroOpacity.length > 0 && heroOpacity.every((opacity) => opacity === '1'), 'the hero entrance sequence completes');
  const emblem = sequencePage.locator('img[src="/brand/emblem.svg"]').first();
  const initialEmblemTransform = await emblem.evaluate((el) => getComputedStyle(el).transform);
  await sequencePage.waitForTimeout(300);
  assert.notEqual(await emblem.evaluate((el) => getComputedStyle(el).transform), initialEmblemTransform, 'background emblems keep animating after the intro');
  const activeWord = await sequencePage.locator('.rw-active').textContent();
  await sequencePage.waitForTimeout(2700);
  assert.notEqual(await sequencePage.locator('.rw-active').textContent(), activeWord, 'rotating words continue cycling after the intro');
  await sequencePage.mouse.move(100, 100);
  const customCursorActive = await sequencePage.evaluate(() => document.documentElement.classList.contains('has-cursor') && document.documentElement.classList.contains('cursor-live'));
  assert.equal(customCursorActive, true, 'the custom cursor activates after intro completion');
  await sequencePage.locator('footer').scrollIntoViewIfNeeded();
  await sequencePage.waitForTimeout(1100);
  assert.equal(await sequencePage.locator('footer [data-reveal]').evaluate((el) => getComputedStyle(el).opacity), '1', 'the footer entrance runs when scrolled into view');
  assert.deepEqual(browserErrors, [], `the homepage should not emit browser errors: ${browserErrors.join('; ')}`);
  await sequenceContext.close();

  const skipContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const skipPage = await skipContext.newPage();
  await skipPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const skipIntro = skipPage.locator('.intro-gate');
  await skipIntro.waitFor({ state: 'visible', timeout: 5000 });
  await skipIntro.getByRole('button', { name: 'Skip introduction' }).click();
  await skipIntro.waitFor({ state: 'detached', timeout: 2000 });
  await skipPage.waitForTimeout(1800);
  assert.equal(await skipPage.locator('#intro-content').evaluate((el) => !el.inert && el.getAttribute('aria-hidden') !== 'true'), true, 'Skip restores the site');
  assert.equal(await skipPage.locator('section[aria-labelledby="hero-h"] [data-reveal]').first().evaluate((el) => getComputedStyle(el).opacity), '1', 'Skip completes the intro and starts the hero entrance');
  await skipContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const mobileIntro = mobilePage.locator('.intro-gate');
  await mobileIntro.waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await mobileIntro.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)', 'mobile intro background is opaque');
  assert.equal(await mobilePage.locator('#intro-content').evaluate((el) => el.inert && el.getAttribute('aria-hidden') === 'true'), true, 'mobile site stays concealed during the intro');
  assert.equal(await mobilePage.evaluate(() => document.elementFromPoint(0, 0)?.closest('.intro-gate') !== null), true, 'mobile intro covers the viewport edge');
  assert.equal(await mobilePage.evaluate(() => document.documentElement.classList.contains('lenis')), false, 'mobile retains native scrolling');
  await mobilePage.evaluate(() => window.scrollTo({ top: 200, behavior: 'auto' }));
  await mobilePage.waitForTimeout(200);
  assert.equal(await mobilePage.evaluate(() => window.scrollY), 0, 'mobile background remains locked during the intro');
  await mobileIntro.getByRole('button', { name: 'Skip introduction' }).click();
  await mobileIntro.waitFor({ state: 'detached', timeout: 2000 });
  assert.equal(await mobilePage.locator('#intro-content').evaluate((el) => !el.inert), true, 'mobile Skip restores the site');
  await mobilePage.evaluate(() => window.scrollTo({ top: 200, behavior: 'auto' }));
  await mobilePage.waitForTimeout(200);
  assert.ok(await mobilePage.evaluate(() => window.scrollY > 0), 'mobile native scrolling resumes after the intro');
  await mobileContext.close();

  console.log('INTRO INTERACTION TESTS PASSED');
} finally {
  await browser.close();
}
