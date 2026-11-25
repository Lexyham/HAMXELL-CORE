export const FIELD = 'mt-2 min-h-[44px] w-full border border-line bg-bg-secondary px-3 py-3 text-body text-ink focus:border-brand-blue focus:outline-none';
export const LABEL = 'block font-mono text-label uppercase text-ink-muted';
export const BTN = 'min-h-[44px] border border-brand-blue bg-brand-blue px-5 py-3 text-small font-medium hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-40';
export const BTN_GHOST = 'min-h-[44px] border border-line px-4 py-2 font-mono text-label uppercase hover:border-ink';
export const BTN_DANGER = 'min-h-[44px] border border-danger px-4 py-2 font-mono text-label uppercase text-danger hover:bg-danger hover:text-bg';

export function Notice({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p role="alert" className="mt-4 text-small text-danger">{error}</p>;
  if (ok) return <p role="status" className="mt-4 text-small text-success">{ok}</p>;
  return null;
}
