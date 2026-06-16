import { Loader2 } from 'lucide-react';

/** Consistent lazy-load placeholder for workspace views and heavy panels. */
export function ViewLoadingFallback({ label }: { label?: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center gap-2 text-muted-foreground"
      style={{ minHeight: 120 }}
      role="status"
      aria-live="polite"
    >
      <Loader2 size={18} className="animate-spin" aria-hidden />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
