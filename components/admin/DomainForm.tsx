import { saveDomain } from '@/app/admin/(console)/domains/actions';
import { BTN, FIELD, LABEL } from './ui';

interface D { id: string; domain: string; project_id: string | null; registrar: string | null; host: string | null; expires_on: string | null; auto_renew: boolean; notes: string }

export default function DomainForm({ domain, projects }: { domain?: D; projects: { id: string; name: string }[] }) {
  return (
    <form action={saveDomain} className="grid gap-5">
      {domain && <input type="hidden" name="id" value={domain.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label className={LABEL} htmlFor="domain">Domain</label><input id="domain" name="domain" required placeholder="example.com" defaultValue={domain?.domain} className={`${FIELD} font-mono`} /></div>
        <div><label className={LABEL} htmlFor="project_id">Project</label>
          <select id="project_id" name="project_id" defaultValue={domain?.project_id ?? ''} className={FIELD}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className={LABEL} htmlFor="registrar">Registrar</label><input id="registrar" name="registrar" defaultValue={domain?.registrar ?? ''} className={FIELD} /></div>
        <div><label className={LABEL} htmlFor="host">Host / DNS provider</label><input id="host" name="host" defaultValue={domain?.host ?? ''} className={FIELD} /></div>
        <div><label className={LABEL} htmlFor="expires_on">Expires on</label><input id="expires_on" name="expires_on" type="date" defaultValue={domain?.expires_on ?? ''} className={FIELD} /></div>
        <label className="flex items-center gap-3 self-end pb-3 text-small"><input type="checkbox" name="auto_renew" defaultChecked={domain?.auto_renew} className="h-[16px] w-[16px] accent-[var(--brand-blue)]" />Auto-renew is on</label>
      </div>
      <div><label className={LABEL} htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={3} defaultValue={domain?.notes ?? ''} className={FIELD} /></div>
      <button type="submit" className={`${BTN} w-fit`}>{domain ? 'Save domain' : 'Add domain'}</button>
    </form>
  );
}
