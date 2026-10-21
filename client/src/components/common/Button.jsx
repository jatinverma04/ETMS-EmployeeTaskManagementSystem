import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { focusRing } from '../../utils/styles';

const variants = {
  primary:
    'border border-primary bg-primary text-surface hover:bg-primary-hover hover:border-primary-hover',
  secondary:
    'border border-border bg-surface text-ink hover:border-primary/50 hover:bg-surface-muted',
  ghost: 'border border-transparent bg-transparent text-ink hover:bg-surface-muted',
  danger:
    'border border-rust bg-rust text-white hover:border-primary-hover hover:bg-primary-hover',
  soft: 'border border-primary/20 bg-primary-soft text-primary hover:bg-primary-soft/70',
};

const sizes = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

function buttonClasses({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
    focusRing,
    variants[variant],
    sizes[size],
    className,
  );
}

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
});

export default Button;

export function LinkButton({
  to,
  state,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) {
  return (
    <Link
      to={to}
      state={state}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {children}
    </Link>
  );
}
