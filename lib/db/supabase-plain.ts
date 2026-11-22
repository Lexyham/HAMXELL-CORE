import { createClient } from '@supabase/supabase-js';

/** Service-role client for the worker process (which runs outside Next.js, so it cannot use the server-only helper). */
export const plainServiceClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
