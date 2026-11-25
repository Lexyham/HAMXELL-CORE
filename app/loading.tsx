export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-page px-[var(--gutter)] py-12" aria-live="polite" aria-busy="true">
      <div className="h-3 w-32 animate-pulse bg-bg-elevated" />
      <div className="mt-6 h-10 max-w-[42rem] animate-pulse bg-bg-elevated" />
      <div className="mt-4 h-4 max-w-[36rem] animate-pulse bg-bg-elevated" />
    </div>
  );
}
