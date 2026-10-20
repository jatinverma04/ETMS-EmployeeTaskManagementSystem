import { cn } from '../../utils/cn';

const priorityClasses = {
  Low: 'text-ink-muted',
  Medium: 'text-amber',
  High: 'text-primary',
  Critical: 'bg-rust-soft text-primary-hover',
};

export default function PriorityBadge({ priority, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        priorityClasses[priority] || 'text-ink-muted',
        className,
      )}
    >
      {priority}
    </span>
  );
}
