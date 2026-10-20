export default function DataTable({ caption, columns, rows, rowKey, emptyState }) {
  if (rows.length === 0) {
    return emptyState;
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ink-muted md:hidden">
        Scroll horizontally to view every column.
      </p>
      <div
        className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm"
        data-scroll-container=""
      >
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted ${column.headerClassName || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="align-top transition-colors hover:bg-surface-muted/40 motion-reduce:transition-none"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-4 text-sm text-ink ${column.className || ''}`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
