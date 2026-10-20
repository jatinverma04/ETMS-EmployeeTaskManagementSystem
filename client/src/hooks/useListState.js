import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isValidDateOnly } from '../utils/date';

function parsePage(rawValue) {
  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return 1;
  }

  const page = Number(rawValue);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function readFilters(searchParams, definitions) {
  const filters = {};

  for (const definition of definitions) {
    const rawValue = searchParams.get(definition.key) || '';

    if (definition.type === 'date') {
      filters[definition.key] = isValidDateOnly(rawValue) ? rawValue : '';
      continue;
    }

    filters[definition.key] = definition.values.includes(rawValue) ? rawValue : '';
  }

  if (
    'dueFrom' in filters &&
    'dueTo' in filters &&
    filters.dueFrom &&
    filters.dueTo &&
    filters.dueTo < filters.dueFrom
  ) {
    filters.dueFrom = '';
    filters.dueTo = '';
  }

  return filters;
}

export function useListState(config) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSearch = searchParams.get('search') || '';
  const search = rawSearch.trim().slice(0, 100);
  const filters = readFilters(searchParams, config.filters);
  const page = parsePage(searchParams.get('page'));
  const rawSort = searchParams.get('sort');
  const sort = config.sorts.includes(rawSort) ? rawSort : config.defaultSort;
  const defaultOrder = config.defaultOrderForSort(sort);
  const rawOrder = searchParams.get('order');
  const order = rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : defaultOrder;

  const updateParams = useCallback(
    (mutator, { replace = false } = {}) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        mutator(next);
        return next;
      }, { replace });
    },
    [setSearchParams],
  );

  const setSearch = useCallback(
    (value) => {
      const trimmed = value.trim().slice(0, 100);

      updateParams((next) => {
        if (trimmed) {
          next.set('search', trimmed);
        } else {
          next.delete('search');
        }

        next.delete('page');
      }, { replace: true });
    },
    [updateParams],
  );

  const setFilters = useCallback(
    (values) => {
      updateParams((next) => {
        for (const [key, value] of Object.entries(values)) {
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
        }

        if (next.get('dueFrom') && next.get('dueTo') && next.get('dueTo') < next.get('dueFrom')) {
          next.delete('dueFrom');
          next.delete('dueTo');
        }

        next.delete('page');
      });
    },
    [updateParams],
  );

  const setFilter = useCallback(
    (key, value) => setFilters({ [key]: value }),
    [setFilters],
  );

  const setSort = useCallback(
    (value) => {
      updateParams((next) => {
        if (value === config.defaultSort) {
          next.delete('sort');
        } else {
          next.set('sort', value);
        }

        next.delete('order');
        next.delete('page');
      });
    },
    [config.defaultSort, updateParams],
  );

  const setOrder = useCallback(
    (value) => {
      updateParams((next) => {
        if (value === defaultOrder) {
          next.delete('order');
        } else {
          next.set('order', value);
        }

        next.delete('page');
      });
    },
    [defaultOrder, updateParams],
  );

  const setPage = useCallback(
    (value) => {
      updateParams((next) => {
        if (value <= 1) {
          next.delete('page');
        } else {
          next.set('page', String(value));
        }
      });
    },
    [updateParams],
  );

  const clearFilters = useCallback(() => {
    updateParams((next) => {
      next.delete('search');

      for (const definition of config.filters) {
        next.delete(definition.key);
      }

      next.delete('page');
    });
  }, [config.filters, updateParams]);

  const apiParams = {
    ...(search ? { search } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    ...(sort !== config.defaultSort ? { sort } : {}),
    ...(order !== defaultOrder ? { order } : {}),
    ...(page > 1 ? { page } : {}),
  };

  const exportParams = {
    ...(search ? { search } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    ...(sort !== config.defaultSort ? { sort } : {}),
    ...(order !== defaultOrder ? { order } : {}),
  };

  const hasActiveFilters =
    Boolean(search) || Object.values(filters).some((value) => Boolean(value));

  return {
    search,
    filters,
    page,
    sort,
    order,
    defaultOrder,
    apiParams,
    exportParams,
    queryKey: JSON.stringify(apiParams),
    hasActiveFilters,
    setSearch,
    setFilter,
    setFilters,
    setSort,
    setOrder,
    setPage,
    clearFilters,
  };
}
