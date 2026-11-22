import type { CookieOptions } from '@supabase/ssr';

/** Auth cookies are only ever touched server-side, so lock them down. */
export function hardenCookie(options: CookieOptions = {}): CookieOptions {
  return { ...options, httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' };
}
