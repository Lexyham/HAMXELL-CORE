/**
 * Horizontal-overflow detector. Runs inside the page.
 *
 * An element is reported when its right edge is beyond the viewport and nothing legitimately clips or scrolls it
 * (an ancestor with overflow-x of auto, scroll, hidden or clip). <html> and <body> are NOT counted as clipping ancestors:
 * the site sets overflow-x on them as a safety net, and that would otherwise hide content being cut off at the screen edge.
 * Position:fixed elements must fit the viewport regardless of their ancestors.
 */
export function pageCheck() {
  const vw = document.documentElement.clientWidth;
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };
  const bad = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 && (cs.position === 'fixed' || !clipped(el))) bad.add(el);
  }
  const outermost = [...bad].filter((el) => !(el.parentElement && bad.has(el.parentElement)));
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`;
  return { vw, scrollWidth: document.documentElement.scrollWidth, offenders: outermost.slice(0, 10).map((el) => ({ el: name(el), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width) })) };
}

export const findOverflow = (page) => page.evaluate(pageCheck);
