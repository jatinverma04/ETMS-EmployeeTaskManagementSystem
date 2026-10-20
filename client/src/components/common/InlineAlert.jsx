import { cn } from '../../utils/cn';

const styles = {
  error: 'border-rust/30 bg-rust-soft text-rust',
  success: 'border-olive/30 bg-olive-soft text-olive',
  info: 'border-primary/20 bg-primary-soft text-primary',
};

export default function InlineAlert({ variant = 'info', className, children }) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border px-4 py-3 text-sm font-medium leading-6',
        styles[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
