export type ExpiryState = 'none' | 'ok' | 'soon' | 'critical' | 'expired';

/** Domain expiry classification. critical = 14 days or fewer, soon = 60 days or fewer. */
export function expiryState(expiresOn: string | null, now = new Date()): { state: ExpiryState; days: number | null } {
  if (!expiresOn) return { state: 'none', days: null };
  const end = Date.parse(`${expiresOn}T00:00:00Z`);
  if (Number.isNaN(end)) return { state: 'none', days: null };
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((end - today) / 864e5);
  return { state: days < 0 ? 'expired' : days <= 14 ? 'critical' : days <= 60 ? 'soon' : 'ok', days };
}
