'use server';

import { headers } from 'next/headers';
import { flag } from '@/lib/flags';
import { verifyGatePassword } from '@/lib/gate';
import { getBySlug, getGateHash } from '@/lib/projects';
import { rateLimit } from '@/lib/rate-limit';

export interface Revealed {
  description: string;
  launchUrl: string | null;
  licenceType: string | null;
  licenceUrl: string | null;
}

/**
 * Called only after the visitor acknowledges the warning (and, if the project has one, enters its password).
 * Details never ship to the browser before that. Password attempts are limited per project and per connection.
 */
export async function revealProject(slug: string, password?: string): Promise<Revealed | { error: string } | null> {
  if (!flag('FEATURE_WARNING_GATED_PROJECTS')) return null;
  const p = await getBySlug(slug, 'warning');
  if (!p) return null;
  const hash = await getGateHash(slug);
  if (hash) {
    const caller = headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; // transient rate-limit key only
    if (!(await rateLimit(`gate:${slug}:${caller}`, 8, 15 * 60 * 1000))) return { error: 'Too many attempts. Try again in 15 minutes.' };
    if (!password || !(await verifyGatePassword(password, hash))) return { error: 'Incorrect password.' };
  }
  return {
    description: p.description ?? '',
    launchUrl: p.launchUrl ?? null,
    licenceType: p.licenceType ?? null,
    licenceUrl: p.licenceUrl ?? null,
  };
}
