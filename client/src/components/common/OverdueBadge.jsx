export default function OverdueBadge({ overdue, className }) {
  if (!overdue) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-rust-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rust ${className || ''}`}
    >
      Overdue
    </span>
  );
}
