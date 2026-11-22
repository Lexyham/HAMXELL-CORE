import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Service-role client. Bypasses RLS. Server-only; never import from a client component. */
export const serviceClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }) },
  });
