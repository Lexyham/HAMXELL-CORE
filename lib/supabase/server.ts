import 'server-only';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { hardenCookie } from './cookies';

/** Session-aware client (acts as the signed-in user, so RLS applies). */
export function createClient() {
  const store = cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: Parameters<SetAllCookies>[0]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, hardenCookie(options)));
        } catch {
          /* called from a Server Component: middleware refreshes the session instead */
        }
      },
    },
  });
}
