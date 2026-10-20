import { cn } from '../../utils/cn';

export default function LoadingSkeleton({ rows = 4, className }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl border border-border bg-surface p-5 motion-reduce:animate-none',
        className,
      )}
      aria-label="Loading"
      role="status"
    >
      <div className="h-4 w-32 rounded bg-border/70" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-12 rounded-lg bg-surface-muted"
          />
        ))}
      </div>
    </div>
  );
}
