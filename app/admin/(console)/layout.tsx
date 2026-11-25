import { signOutAction } from '@/app/admin/login/actions';
import AdminNav, { AdminMobileNav } from '@/components/admin/AdminNav';
import { requireAdmin } from '@/lib/auth';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { email, role } = await requireAdmin();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
      <AdminNav isOwner={role === 'owner'} />
      <div className="min-w-0">
        <header className="flex flex-col gap-3 border-b border-line px-[var(--gutter)] py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4 sm:min-w-0 sm:flex-1 lg:hidden">
            <AdminMobileNav isOwner={role === 'owner'} />
            <p className="min-w-0 truncate text-right font-mono text-label uppercase text-ink-muted">{email} / {role}</p>
          </div>

          <p className="hidden min-w-0 truncate font-mono text-label uppercase text-ink-muted lg:block">{email} / {role}</p>

          <div className="flex w-full items-center gap-2 sm:w-auto lg:hidden">
            <a
              href="/admin/account/password"
              className="flex min-h-[44px] flex-1 items-center justify-center border border-line px-3 font-mono text-label uppercase text-ink-muted hover:border-ink hover:text-ink sm:flex-none"
            >
              Password
            </a>
            <form action={signOutAction} className="flex-1 sm:flex-none">
              <button
                type="submit"
                className="min-h-[44px] w-full border border-line px-3 font-mono text-label uppercase hover:border-ink sm:w-auto"
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <a
              href="/admin/account/password"
              className="flex min-h-[44px] items-center px-3 font-mono text-label uppercase text-ink-muted hover:text-ink"
            >
              Password
            </a>
            <form action={signOutAction}>
              <button type="submit" className="min-h-[44px] border border-line px-3 font-mono text-label uppercase hover:border-ink">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="px-[var(--gutter)] py-6">{children}</main>
      </div>
    </div>
  );
}
