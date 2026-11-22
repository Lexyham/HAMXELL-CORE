/**
 * Pure state machine for when the chat launcher is visible (spec: appears on scroll-down, hides on scroll-up,
 * and always shows after a 3 second pause; reduced-motion users always see it).
 */
export const IDLE_MS = 3000;
export const SCROLL_THRESHOLD = 8;
export interface Vis { atTop: boolean; lastY: number; dir: 'up' | 'down' | 'none'; idle: boolean; open: boolean; reduced: boolean }
export const initialVis = (reduced = false): Vis => ({ atTop: true, lastY: 0, dir: 'none', idle: false, open: false, reduced });

export const onScroll = (s: Vis, y: number): Vis => {
  const d = y - s.lastY;
  if (Math.abs(d) < SCROLL_THRESHOLD) return s;
  return { ...s, lastY: y, dir: d > 0 ? 'down' : 'up', idle: false };
};
export const onIdle = (s: Vis): Vis => ({ ...s, idle: true });
export const onAtTop = (s: Vis, atTop: boolean): Vis => (atTop === s.atTop ? s : { ...s, atTop, idle: false, dir: atTop ? 'none' : s.dir });
export const onOpen = (s: Vis, open: boolean): Vis => ({ ...s, open });
export const isVisible = (s: Vis): boolean => s.reduced || s.open || s.idle || (s.dir === 'down' && !s.atTop);
