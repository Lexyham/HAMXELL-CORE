export default function AdminLoading() {
  return (
    <div className="max-w-[56rem]" aria-live="polite" aria-busy="true">
      <div className="h-8 w-48 animate-pulse bg-bg-elevated" />
      <div className="mt-6 divide-y divide-line border-y border-line">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-16 animate-pulse border-b border-line bg-bg-secondary last:border-b-0" />
        ))}
      </div>
    </div>
  );
}
