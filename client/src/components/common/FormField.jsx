import { cloneElement, isValidElement, useId } from 'react';
import { cn } from '../../utils/cn';

export default function FormField({
  id,
  label,
  required = false,
  error,
  hint,
  children,
  className,
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const labelId = `${fieldId}-label`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: fieldId,
        'aria-labelledby': labelId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        id={labelId}
        htmlFor={fieldId}
        className="block text-sm font-semibold text-ink"
      >
        {label}
        {required ? (
          <span className="ml-1 text-rust" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-rust" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
