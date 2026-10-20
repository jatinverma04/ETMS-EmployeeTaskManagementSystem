import { cn } from '../../utils/cn';

const statusClasses = {
  Todo: 'bg-surface-muted text-ink-muted',
  'In Progress': 'bg-amber-soft text-amber',
  Completed: 'bg-olive-soft text-olive',
  Cancelled: 'bg-rust-soft text-rust',
};

export default function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        statusClasses[status] || 'bg-surface-muted text-ink-muted',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}
