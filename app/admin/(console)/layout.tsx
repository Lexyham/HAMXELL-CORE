import { signOutAction } from '@/app/admin/login/actions';
import AdminNav from '@/components/admin/AdminNav';
import { requireAdmin } from '@/lib/auth';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { email, role } = await requireAdmin();
  return (
    <div className="md:grid md:min-h-screen md:grid-cols-[13rem_1fr]">
      <aside className="border-b border-line bg-bg-secondary md:border-b-0 md:border-r">
        <div className="px-4 py-4">
          <p className="font-sans text-small font-semibold tracking-[0.18em]">HAMXELL CORE</p>
          <p className="mt-1 font-mono text-label uppercase text-ink-muted">Control centre</p>
        </div>
        <div className="px-1 pb-3 md:pb-6">
          <AdminNav isOwner={role === 'owner'} />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[var(--gutter)] py-3">
          <p className="break-all font-mono text-label uppercase text-ink-muted">{email} / {role}</p>
          <div className="flex items-center gap-3">
          <a href="/admin/account/password" className="px-3 py-2 font-mono text-label uppercase text-ink-muted hover:text-ink">Password</a>
          <form action={signOutAction}>
            <button type="submit" className="border border-line px-3 py-2 font-mono text-label uppercase hover:border-ink">Sign out</button>
          </form>
          </div>
        </header>
        <main className="px-[var(--gutter)] py-6">{children}</main>
      </div>
    </div>
  );
}
