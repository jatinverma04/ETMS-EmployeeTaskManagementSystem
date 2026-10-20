import Button from './Button';
import { cn } from '../../utils/cn';

export default function IconButton({
  label,
  className,
  variant = 'ghost',
  size = 'sm',
  children,
  ...props
}) {
  return (
    <Button
      aria-label={label}
      variant={variant}
      size={size}
      className={cn('min-w-11 px-0', className)}
      {...props}
    >
      {children}
    </Button>
  );
}
