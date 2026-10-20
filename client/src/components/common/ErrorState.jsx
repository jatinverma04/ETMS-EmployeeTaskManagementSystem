import Button from './Button';
import Icon from './Icon';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rust/30 bg-rust-soft px-6 py-10 text-center" role="alert">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-rust">
        <Icon name="alert" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">
        {message || 'The request could not be completed.'}
      </p>
      {onRetry ? (
        <Button className="mt-6" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
