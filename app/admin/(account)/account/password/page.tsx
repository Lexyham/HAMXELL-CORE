import { requireAdmin } from '@/lib/auth';
import PasswordForm from './PasswordForm';

export default async function PasswordPage() {
  const { user } = await requireAdmin({ allowPasswordChange: true });
  const forced = user.app_metadata?.must_change_password === true;
  return (
    <div>
      <h1 className="text-h1 font-semibold">{forced ? 'Choose a new password' : 'Change password'}</h1>
      {forced && <p className="mt-3 border border-warning p-4 text-small text-warning">This account was created with a temporary password. Set your own now to continue.</p>}
      <div className="mt-6"><PasswordForm /></div>
    </div>
  );
}
