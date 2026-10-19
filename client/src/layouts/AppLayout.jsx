export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink selection:bg-primary-soft selection:text-ink">
      <header className="bg-header text-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold tracking-wider text-surface">
              ET
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-surface/70">ETMS</p>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                Employee Task Management
              </h1>
            </div>
          </div>
          <span className="w-fit rounded-full border border-surface/20 bg-surface/10 px-3 py-1 text-xs font-medium tracking-wide text-surface">
            Phase 1 foundation
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-sm text-ink-muted sm:px-6 lg:px-8">
        React + Vite + Tailwind CSS · Express + MongoDB
      </footer>
    </div>
  );
}
