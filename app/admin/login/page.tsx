import { supabaseConfigured } from '@/lib/supabase/config';
import LoginForm from './LoginForm';

export default function AdminLoginPage() {
  return (
    <main className="mx-auto w-full max-w-[26rem] px-[var(--gutter)] py-8">
      <p className="font-mono text-label uppercase text-brand-gold">HAMXELL CORE</p>
      <h1 className="mt-4 text-h1 font-semibold">Sign in</h1>
      <div className="mt-6">
        <LoginForm configured={supabaseConfigured()} />
      </div>
    </main>
  );
}
