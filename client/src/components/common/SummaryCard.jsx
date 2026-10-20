import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { focusRing } from '../../utils/styles';

const toneClasses = {
  default: 'border-border bg-surface',
  primary: 'border-primary/20 bg-primary-soft',
  olive: 'border-olive/20 bg-olive-soft',
  amber: 'border-amber/20 bg-amber-soft',
  rust: 'border-rust/20 bg-rust-soft',
};

export default function SummaryCard({ label, value, to, tone = 'default' }) {
  const content = (
    <>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          'rounded-2xl border p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-surface sm:p-6 motion-reduce:transition-none',
          toneClasses[tone],
          focusRing,
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={cn('rounded-2xl border p-5 shadow-sm sm:p-6', toneClasses[tone])}>
      {content}
    </div>
  );
}
