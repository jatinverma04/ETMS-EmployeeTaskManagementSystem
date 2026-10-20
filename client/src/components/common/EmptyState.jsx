import Icon from './Icon';

export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name="clipboard" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
