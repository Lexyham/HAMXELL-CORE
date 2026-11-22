import AddAdminForm from '@/components/admin/AddAdminForm';
import { BTN_DANGER, BTN_GHOST, Notice } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth';
import { FLAGS, flag } from '@/lib/flags';
import { SITE } from '@/lib/site';
import { serviceClient } from '@/lib/supabase/admin';
import { removeAdmin, setAdminRole } from './actions';

export default async function SettingsPage({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const { user, role } = await requireAdmin();
  const owner = role === 'owner';
  const { data: admins } = owner ? await serviceClient().from('admins').select('user_id, email, role, created_at').order('created_at') : { data: null };

  return (
    <div className="max-w-[56rem]">
      <h1 className="text-h1 font-semibold">Settings</h1>
      <Notice error={searchParams.error} ok={searchParams.ok} />

      <section className="mt-8" aria-labelledby="org-h">
        <h2 id="org-h" className="font-mono text-label uppercase text-ink-muted">Organisation</h2>
        <dl className="mt-3 divide-y divide-line border-y border-line text-small">
          {[['Name', SITE.name], ['Tagline', SITE.tagline], ['Description', SITE.description], ['Public address', process.env.APP_URL ?? 'Not set (APP_URL)']].map(([k, v]) => (
            <div key={k} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]"><dt className="text-ink-muted">{k}</dt><dd className="break-words">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-2 text-small text-ink-muted">These come from the code (lib/site.ts) and the environment, so they are changed there.</p>
      </section>

      <section className="mt-10" aria-labelledby="flags-h">
        <h2 id="flags-h" className="font-mono text-label uppercase text-ink-muted">Feature flags</h2>
        <p className="mt-2 max-w-[62ch] text-small text-ink-muted">Flags are environment variables. Set one to <code className="font-mono">false</code> to switch the feature off (its page then shows Coming soon); change it in your hosting environment and redeploy or restart.</p>
        <ul className="mt-3 divide-y divide-line border-y border-line text-small">
          {FLAGS.map((f) => {
            const on = flag(f.name);
            return (
              <li key={f.name} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:gap-5">
                <span><span className="block font-mono">{f.name}</span><span className="block text-ink-muted">{f.summary} {!on && !f.reserved ? <span className="text-warning">Off: {f.off}</span> : null}</span></span>
                <span className={`font-mono text-label uppercase ${f.reserved ? 'text-ink-muted' : on ? 'text-success' : 'text-warning'}`}>{f.reserved ? 'Reserved' : on ? 'On' : 'Off'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="admins-h">
        <h2 id="admins-h" className="font-mono text-label uppercase text-ink-muted">Administrators</h2>
        {!owner ? <p className="mt-3 border border-line p-4 text-small text-ink-muted">Only owners can see and manage administrators.</p> : (
          <>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {(admins ?? []).map((a) => (
                <li key={a.user_id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-5">
                  <span><span className="block break-all text-body">{a.email}{a.user_id === user.id ? <span className="ml-2 font-mono text-label uppercase text-brand-gold">you</span> : null}</span><span className="block font-mono text-label uppercase text-ink-muted">{a.role} / since {new Date(a.created_at).toLocaleDateString('en-GB')}</span></span>
                  {a.user_id !== user.id && (
                    <span className="flex flex-wrap items-center gap-3">
                      <form action={setAdminRole}><input type="hidden" name="id" value={a.user_id} /><input type="hidden" name="role" value={a.role === 'owner' ? 'editor' : 'owner'} /><button type="submit" className={BTN_GHOST}>Make {a.role === 'owner' ? 'editor' : 'owner'}</button></form>
                      <form action={removeAdmin}><input type="hidden" name="id" value={a.user_id} /><button type="submit" className={BTN_DANGER}>Remove</button></form>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="mt-6 font-mono text-label uppercase text-ink-muted">Add an administrator</h3>
            <div className="mt-3"><AddAdminForm /></div>
          </>
        )}
      </section>
    </div>
  );
}
