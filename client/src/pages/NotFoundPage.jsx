import { LinkButton } from '../components/common/Button';
import Icon from '../components/common/Icon';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface px-6 py-20 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name="search" className="h-6 w-6" />
      </div>
      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">
        The page you requested does not exist. Use the dashboard to return to the application.
      </p>
      <LinkButton className="mt-6" to="/dashboard">
        Go to dashboard
      </LinkButton>
    </div>
  );
}
