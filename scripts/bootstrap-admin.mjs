// Creates the first admin from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD. Run: npm run bootstrap-admin
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_PASSWORD: password } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !email || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in .env.local');
  process.exit(1);
}
if (password.length < 12) {
  console.error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let userId;
const created = await sb.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { must_change_password: true } });
if (created.error) {
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  userId = data?.users.find((u) => u.email === email)?.id;
  if (!userId) {
    console.error('Could not create or find user:', created.error.message);
    process.exit(1);
  }
  console.log('User already exists, granting admin role.');
} else {
  userId = created.data.user.id;
}

const { error } = await sb.from('admins').upsert({ user_id: userId, email, role: 'owner' });
if (error) {
  console.error('Could not register admin (did you run the SQL migration?):', error.message);
  process.exit(1);
}
console.log(`Admin ready: ${email}. Sign in at /admin/login; you will be asked to enrol an authenticator app, then to choose a new password.`);
