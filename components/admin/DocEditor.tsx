'use client';

import { useMemo, useState } from 'react';
import { renderMarkdown } from '@/lib/markdown';
import { saveDoc } from '@/app/admin/(console)/projects/[id]/docs/actions';

const field = 'mt-2 w-full border border-line bg-bg-secondary px-3 py-3 text-body text-ink focus:border-brand-blue focus:outline-none';
const label = 'block font-mono text-label uppercase text-ink-muted';

interface Props {
  projectId: string;
  kind: string;
  initial: { title: string; content: string; status: 'draft' | 'published' };
  projectIsPublic: boolean;
  fromAi: boolean;
}

/** Markdown editor with a live preview. The preview uses the same escaping renderer as the public reader. */
export default function DocEditor({ projectId, kind, initial, projectIsPublic, fromAi }: Props) {
  const [content, setContent] = useState(initial.content);
  const [status, setStatus] = useState(initial.status);
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <form action={saveDoc} className="grid gap-6">
      <input type="hidden" name="id" value={projectId} />
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-6 sm:grid-cols-[1fr_14rem]">
        <div>
          <label className={label} htmlFor="title">Title</label>
          <input id="title" name="title" maxLength={120} defaultValue={initial.title} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="status">Status</label>
          <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')} className={field}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {status === 'published' && (
        <p className={`border p-3 text-small ${projectIsPublic ? 'border-line text-ink-muted' : 'border-warning text-warning'}`}>
          {projectIsPublic
            ? 'Published documents appear in the public documentation reader.'
            : 'This project is not public, so this document will not appear publicly until the project visibility is set to Public.'}
        </p>
      )}
      {fromAi && <p className="border border-line p-3 text-small text-ink-muted">This began as an AI draft. Check it against the real project before publishing. Saving marks it as manually edited, so regeneration will no longer overwrite it.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className={label} htmlFor="content">Markdown</label>
          <textarea id="content" name="content" required rows={26} value={content} onChange={(e) => setContent(e.target.value)} spellCheck className={`${field} font-mono text-small leading-relaxed`} />
          <p className="mt-1 text-small text-ink-muted">{content.length.toLocaleString('en-GB')} / 100,000 characters. Raw HTML is not rendered.</p>
        </div>
        <div className="min-w-0">
          <p className={label}>Preview</p>
          <div className="mt-2 max-h-[40rem] overflow-auto border border-line p-5">
            <div className="doc" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>

      <button type="submit" className="w-fit border border-brand-blue bg-brand-blue px-6 py-3 text-small font-medium hover:bg-transparent">Save document</button>
    </form>
  );
}
