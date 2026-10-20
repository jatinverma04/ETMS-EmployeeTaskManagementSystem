import Button from './Button';
import Icon from './Icon';

function buildPageItems(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) {
    items.push('start-ellipsis');
  }

  for (let current = start; current <= end; current += 1) {
    items.push(current);
  }

  if (end < totalPages - 1) {
    items.push('end-ellipsis');
  }

  items.push(totalPages);
  return items;
}

export default function Pagination({ page, limit, total, totalPages, onPageChange }) {
  if (total === 0) {
    return null;
  }

  const firstItem = (page - 1) * limit + 1;
  const lastItem = Math.min(page * limit, total);
  const pageItems = buildPageItems(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-ink-muted">
        Showing <span className="font-semibold text-ink">{firstItem}</span>–
        <span className="font-semibold text-ink">{lastItem}</span> of{' '}
        <span className="font-semibold text-ink">{total}</span>
      </p>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {pageItems.map((item) =>
            typeof item === 'number' ? (
              <Button
                key={item}
                size="sm"
                variant={item === page ? 'primary' : 'ghost'}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
                className="min-w-11 px-0"
              >
                {item}
              </Button>
            ) : (
              <span
                key={item}
                className="px-1 text-sm text-ink-muted"
                aria-hidden="true"
              >
                …
              </span>
            ),
          )}

          <Button
            size="sm"
            variant="ghost"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <span className="hidden sm:inline">Next</span>
            <Icon name="chevronRight" className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}
