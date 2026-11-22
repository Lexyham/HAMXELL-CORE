/** Upload validation for the asset library. Type is decided from the file name AND its content, never from the client's claim. */
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;

type Rule = { type: string; check: (b: Uint8Array) => boolean };
const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const text = (b: Uint8Array) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return null;
  }
};

const RULES: Record<string, Rule> = {
  png: { type: 'image/png', check: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  jpg: { type: 'image/jpeg', check: (b) => starts(b, [0xff, 0xd8, 0xff]) },
  jpeg: { type: 'image/jpeg', check: (b) => starts(b, [0xff, 0xd8, 0xff]) },
  gif: { type: 'image/gif', check: (b) => starts(b, [0x47, 0x49, 0x46, 0x38]) },
  webp: { type: 'image/webp', check: (b) => starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8) },
  pdf: { type: 'application/pdf', check: (b) => starts(b, [0x25, 0x50, 0x44, 0x46]) },
  txt: { type: 'text/plain', check: (b) => text(b) !== null && !b.includes(0) },
  md: { type: 'text/markdown', check: (b) => text(b) !== null && !b.includes(0) },
  json: { type: 'application/json', check: (b) => { const t = text(b); if (t === null) return false; try { JSON.parse(t); return true; } catch { return false; } } },
};
export const ALLOWED_EXTENSIONS = Object.keys(RULES);

export function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const clean = base.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').replace(/-+/g, '-').slice(0, 100);
  return clean || 'file';
}

export function validateUpload(name: string, bytes: Uint8Array): { ok: true; contentType: string; name: string } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: 'The file is empty.' };
  if (bytes.length > MAX_ASSET_BYTES) return { ok: false, error: 'The file is larger than 10 MB.' };
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  const rule = RULES[ext];
  if (!rule || !name.includes('.')) return { ok: false, error: `File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.` };
  if (!rule.check(bytes)) return { ok: false, error: `The file content does not match its .${ext} extension.` };
  const stem = safeName(name.slice(0, name.lastIndexOf('.'))).replace(/\.+$/, '') || 'file';
  return { ok: true, contentType: rule.type, name: `${stem}.${ext}` }; // extension always present and lower-case
}
