import type { ImportResult } from '../importer/analyze';
import type { Product } from '../products';
import { AiError } from './types';

/**
 * The ONLY way project data enters an AI prompt. It is an allowlist of public-safe fields, so credentials
 * vault entries, project secrets and admin metadata cannot be included by construction.
 */
export function projectContext(p: Product, imp?: ImportResult | null): string {
  const lines = [
    `Name: ${p.name}`,
    `Summary: ${p.summary || 'Not provided.'}`,
    `Status: ${p.status}`,
    `Technology tags (as recorded): ${p.tags.join(', ') || 'Not provided.'}`,
    `Website: ${p.launchUrl || 'Not provided.'}`,
    `Licence: ${p.licenceType || 'Not provided.'}`,
    `Description:\n${p.description || 'Not provided.'}`,
  ];
  if (imp) {
    const o = imp.observed;
    lines.push(
      '',
      'Importer findings from the public landing page (headings, navigation and calls to action are [observed]; technology and features are [inferred]):',
      `Headings: ${o.headings.slice(0, 12).join(' | ') || 'none'}`,
      `Navigation: ${o.nav.map((n) => n.text).join(' | ') || 'none'}`,
      `Calls to action: ${o.buttons.join(' | ') || 'none'}`,
      `Inferred features: ${imp.features.join('; ') || 'none'}`,
      `Inferred technology: ${imp.tech.map((t) => t.name).join(', ') || 'none'}`,
    );
  }
  return lines.join('\n');
}

export const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bgsk_[A-Za-z0-9]{20,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/,
  /\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{6,}/i,
];

/** Defence in depth: refuse to send anything that looks like a credential to an external provider. */
export const looksLikeSecret = (text: string) => SECRET_PATTERNS.some((re) => re.test(text));

export function assertNoSecrets(text: string) {
  if (looksLikeSecret(text)) {
    throw new AiError('Blocked: the prompt appears to contain a credential. Nothing was sent to any AI provider.');
  }
}
