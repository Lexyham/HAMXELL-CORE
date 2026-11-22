import { saveProject } from '@/app/admin/(console)/projects/actions';
import { CATEGORIES, CATEGORY_LABEL, Product, STATUS_LABEL, STATUSES, VISIBILITIES, VISIBILITY_LABEL } from '@/lib/products';

const input = 'mt-2 w-full border border-line bg-bg-secondary px-3 py-3 text-body text-ink focus:border-brand-blue focus:outline-none';
const label = 'block font-mono text-label uppercase text-ink-muted';
const hint = 'mt-1 text-small text-ink-muted';

const VIS_HINT: Record<string, string> = {
  public: 'Listed in the directory and search engines.',
  unlisted: 'Reachable at /u/slug only. Not listed, noindex.',
  warning: 'Reachable at /p/slug behind an acknowledgement notice. Noindex.',
  private: 'Visible to admins only. Returns 404 publicly.',
};

export default function ProjectForm({ project, hasGate = false }: { project?: Product; hasGate?: boolean }) {
  const p = project;
  return (
    <form action={saveProject} className="grid max-w-[44rem] gap-6">
      {p?.id && <input type="hidden" name="id" value={p.id} />}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">Name</label>
          <input id="name" name="name" required maxLength={120} defaultValue={p?.name} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="slug">Slug</label>
          <input id="slug" name="slug" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={p?.slug} className={`${input} font-mono`} />
          <p className={hint}>Lowercase letters, numbers and hyphens.</p>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="summary">Summary</label>
        <input id="summary" name="summary" maxLength={240} defaultValue={p?.summary} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={7} defaultValue={p?.description} className={input} />
        <p className={hint}>Separate paragraphs with a blank line.</p>
      </div>

      <div>
        <label className={label} htmlFor="category">Listed under</label>
        <select id="category" name="category" defaultValue={p?.category ?? 'product'} className={input}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}s</option>
          ))}
        </select>
        <p className={hint}>Products appear under Products, experiments under Experiments, labs under Labs.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={p?.status ?? 'in_development'} className={input}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="visibility">Visibility</label>
          <select id="visibility" name="visibility" defaultValue={p?.visibility ?? 'private'} className={input}>
            {VISIBILITIES.map((v) => (
              <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
            ))}
          </select>
        </div>
      </div>
      <ul className="grid gap-1 border border-line p-4 text-small text-ink-muted">
        {VISIBILITIES.map((v) => (
          <li key={v}><span className="font-mono text-label uppercase text-ink">{VISIBILITY_LABEL[v]}</span> {VIS_HINT[v]}</li>
        ))}
      </ul>

      <div>
        <label className={label} htmlFor="warning_text">Warning notice</label>
        <textarea id="warning_text" name="warning_text" rows={3} defaultValue={p?.warningText ?? ''} className={input} />
        <p className={hint}>Shown on warning-gated projects. A default notice is used when empty.</p>
      </div>

      <div>
        <label className={label} htmlFor="gate_password">Access password (warning-gated projects)</label>
        <input id="gate_password" name="gate_password" type="password" minLength={6} maxLength={200} autoComplete="new-password" placeholder={hasGate ? 'A password is set. Type a new one to replace it.' : 'Optional'} className={input} />
        <p className={hint}>Visitors must acknowledge the notice and enter this password. It is stored only as a salted hash and cannot be shown again.</p>
        {hasGate && <label className="mt-2 flex items-center gap-3 text-small"><input type="checkbox" name="remove_gate" className="h-[16px] w-[16px] accent-[var(--brand-blue)]" />Remove the password</label>}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="launch_url">Launch URL</label>
          <input id="launch_url" name="launch_url" type="url" defaultValue={p?.launchUrl ?? ''} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="tags">Technology tags</label>
          <input id="tags" name="tags" defaultValue={p?.tags.join(', ')} className={input} />
          <p className={hint}>Comma separated.</p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="licence_type">Licence</label>
          <input id="licence_type" name="licence_type" defaultValue={p?.licenceType ?? ''} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="licence_url">Licence URL</label>
          <input id="licence_url" name="licence_url" type="url" defaultValue={p?.licenceUrl ?? ''} className={input} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="licence_text">Licence terms</label>
        <textarea id="licence_text" name="licence_text" rows={3} defaultValue={p?.licenceText ?? ''} className={input} />
      </div>

      <label className="flex items-center gap-3 text-small">
        <input type="checkbox" name="featured" defaultChecked={p?.featured} className="h-[16px] w-[16px] accent-[var(--brand-blue)]" />
        Feature on the homepage (public projects only)
      </label>

      <button type="submit" className="w-fit border border-brand-blue bg-brand-blue px-6 py-3 text-small font-medium hover:bg-transparent">
        {p ? 'Save changes' : 'Create project'}
      </button>
    </form>
  );
}
