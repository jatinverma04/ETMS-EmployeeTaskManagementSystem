import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { focusRing } from '../../utils/styles';

export default function AppLink({ to, state, className, children, ...props }) {
  return (
    <Link
      to={to}
      state={state}
      className={cn(
        'inline-flex min-h-11 items-center rounded-sm text-primary underline underline-offset-2 transition-colors hover:text-primary-hover motion-reduce:transition-none',
        focusRing,
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
