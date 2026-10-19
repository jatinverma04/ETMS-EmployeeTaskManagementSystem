export default function FoundationPage() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        Project foundation
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Ready for the next build phase.
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-ink-muted">
        The React, Vite, Tailwind CSS, Express, and MongoDB foundation is in place. Employee and
        task features will be added in later phases.
      </p>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-olive-soft px-3 py-1 text-xs font-semibold text-olive">
        <span className="h-2 w-2 rounded-full bg-olive" aria-hidden="true" />
        Foundation prepared
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-border bg-canvas p-5">
          <h3 className="text-sm font-semibold text-ink">Frontend</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            React + Vite with the approved warm-neutral Tailwind theme.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-canvas p-5">
          <h3 className="text-sm font-semibold text-ink">Backend</h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Express API with MongoDB health reporting and centralized error handling.
          </p>
        </article>
      </div>

      <p className="mt-8 border-t border-border pt-5 text-sm text-ink-muted">
        Health check:{' '}
        <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-ink">
          GET /api/health
        </code>
      </p>
    </section>
  );
}
