import ProjectForm from '@/components/admin/ProjectForm';
import { requireAdmin } from '@/lib/auth';

export default async function NewProjectPage({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-h1 font-semibold">New project</h1>
      {searchParams.error && <p role="alert" className="mt-4 text-small text-danger">{searchParams.error}</p>}
      <div className="mt-6"><ProjectForm /></div>
    </div>
  );
}
