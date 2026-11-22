import { SECRET_PATTERNS } from '../ai/context';

/** Removes personal data from text before it is stored in chat logs (conversations are logged anonymised). */
export function scrubPii(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\bhttps?:\/\/\S+/gi, '[link]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[number]')
    .replace(/\b\d{6,}\b/g, '[number]');
}

/** Replaces anything that looks like a credential, so it can never reach a prompt. Returns the cleaned text and how many were removed. */
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0, out = text;
  for (const p of SECRET_PATTERNS) {
    out = out.replace(new RegExp(p.source, p.flags.includes('g') ? p.flags : `${p.flags}g`), () => { count++; return '[redacted]'; });
  }
  return { text: out, count };
}
