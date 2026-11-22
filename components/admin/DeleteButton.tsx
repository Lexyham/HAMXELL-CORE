'use client';

import { deleteProject } from '@/app/admin/(console)/projects/actions';

export default function DeleteButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteProject}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`Delete "${name}" permanently? This cannot be undone.`)) e.preventDefault();
        }}
        className="border border-danger px-4 py-2 font-mono text-label uppercase text-danger hover:bg-danger hover:text-bg"
      >
        Delete
      </button>
    </form>
  );
}
