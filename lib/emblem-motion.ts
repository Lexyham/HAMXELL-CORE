/**
 * Motion maths for the site-wide background emblems (pure functions, no DOM).
 * Each emblem drifts against the page as you scroll (parallax), turns with scroll distance, and also turns slowly on its own.
 * Holding a press anywhere speeds the turning up, and releasing eases it back down.
 */
export interface Spot {
  top: number;      // px from the top of the page (centre of the emblem)
  left: number;     // % from the left edge (centre of the emblem)
  size: number;     // px
  opacity: number;
  par: number;      // parallax factor: px of drift per px scrolled, relative to the page content (+/-)
  spin: number;     // idle turning speed, degrees per second (signed)
}

export const LONG_PRESS_MS = 350;
export const MOVE_CANCEL_PX = 12;
export const IDLE_MULT = 1;
export const MAX_MULT = 10;
export const SCROLL_DEG_PER_PX = 0.07; // 45 degrees over roughly one screen, as before

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const seed = (i: number) => { const x = Math.sin((i + 1) * 12.9898) * 43758.5453; return x - Math.floor(x); }; // stable 0..1

/** Spreads emblems down the whole page: roughly one per screenful, alternating sides, varied size, opacity and direction. */
export function makeSpots(pageHeight: number, viewportWidth: number): Spot[] {
  const small = viewportWidth < 768;
  const spacing = small ? 720 : 900;
  const count = clamp(Math.ceil(pageHeight / spacing), 3, 14);
  const step = pageHeight / count;
  const LEFTS = small ? [84, 10, 76, 18] : [80, 7, 68, 20, 88, 12];
  return Array.from({ length: count }, (_, i) => {
    const r = seed(i), q = seed(i + 40);
    const base = small ? 200 + r * 120 : 280 + r * 260;
    const sign = i % 2 === 0 ? 1 : -1;
    return {
      top: Math.round((i + 0.5) * step + (r - 0.5) * step * 0.25),
      left: LEFTS[i % LEFTS.length] + (q - 0.5) * 6,
      size: Math.round(base),
      opacity: Number((small ? 0.12 + q * 0.08 : 0.14 + q * 0.1).toFixed(3)),
      par: sign * (0.1 + r * 0.18),
      spin: sign * (4 + q * 5),
    };
  });
}

/** Eases the speed multiplier toward MAX_MULT while pressed and back to IDLE_MULT when released. */
export function nextMult(mult: number, pressed: boolean, dtSec: number): number {
  const target = pressed ? MAX_MULT : IDLE_MULT;
  const rate = pressed ? 3.2 : 1.8; // ramps up faster than it settles
  const k = 1 - Math.exp(-rate * clamp(dtSec, 0, 0.1));
  const m = mult + (target - mult) * k;
  return Math.abs(target - m) < 0.01 ? target : m;
}

/** Advances an emblem's idle turning (degrees). The multiplier scales only the idle spin, so scroll reaction is unchanged. */
export const advance = (accum: number, spin: number, mult: number, dtSec: number) => accum + spin * mult * clamp(dtSec, 0, 0.1);

/** Vertical drift and rotation for one emblem at the current scroll position. */
export function transformFor(s: Spot, accum: number, scrollY: number, viewportHeight: number) {
  const y = (scrollY + viewportHeight / 2 - s.top) * s.par;
  const rot = accum + scrollY * SCROLL_DEG_PER_PX * Math.sign(s.spin || 1);
  return { y, rot };
}

/** True when an emblem is near the viewport and worth updating this frame. */
export const isNear = (s: Spot, scrollY: number, viewportHeight: number) =>
  Math.abs(s.top + (scrollY + viewportHeight / 2 - s.top) * s.par - (scrollY + viewportHeight / 2)) < viewportHeight / 2 + s.size;

/** Long-press tracker: call down/move/up with pointer coordinates; `pressed` is true once held long enough without moving. */
export function createPress(now: () => number = () => Date.now()) {
  let startAt = 0, sx = 0, sy = 0, down = false, cancelled = false;
  return {
    down(x: number, y: number) { down = true; cancelled = false; startAt = now(); sx = x; sy = y; },
    move(x: number, y: number) { if (down && Math.hypot(x - sx, y - sy) > MOVE_CANCEL_PX && now() - startAt < LONG_PRESS_MS) cancelled = true; },
    up() { down = false; cancelled = false; },
    get pressed() { return down && !cancelled && now() - startAt >= LONG_PRESS_MS; },
  };
}
