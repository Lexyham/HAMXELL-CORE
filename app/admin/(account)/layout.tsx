import { signOutAction } from '@/app/admin/login/actions';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[34rem] px-[var(--gutter)] py-8">
      <div className="flex items-center justify-between gap-4">
        <p className="font-sans text-small font-semibold tracking-[0.18em]">HAMXELL CORE</p>
        <form action={signOutAction}><button type="submit" className="border border-line px-3 py-2 font-mono text-label uppercase hover:border-ink">Sign out</button></form>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
