import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getApiError } from '../api/client';
import {
  deleteTask,
  downloadTasksCsv,
  listTasks,
  updateTaskStatus,
} from '../api/tasks';
import ActionMenu from '../components/common/ActionMenu';
import AppLink from '../components/common/AppLink';
import Button, { LinkButton } from '../components/common/Button';
import ConfirmDialog from '../components/common/ConfirmDialog';
import DataTable from '../components/common/DataTable';
import DateInput from '../components/common/DateInput';
import DebouncedSearchInput from '../components/common/DebouncedSearchInput';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import FormField from '../components/common/FormField';
import Icon from '../components/common/Icon';
import IconButton from '../components/common/IconButton';
import InlineAlert from '../components/common/InlineAlert';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import OverdueBadge from '../components/common/OverdueBadge';
import PageHeader from '../components/common/PageHeader';
import Pagination from '../components/common/Pagination';
import PriorityBadge from '../components/common/PriorityBadge';
import Select from '../components/common/Select';
import StatusBadge from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import TaskStatusMenu from '../components/tasks/TaskStatusMenu';
import { useApiResource } from '../hooks/useApiResource';
import { useListState } from '../hooks/useListState';
import {
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_SORT_OPTIONS,
  TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  defaultTaskOrder,
} from '../utils/constants';
import { formatDate, isValidDateOnly } from '../utils/date';

const listConfig = {
  filters: [
    { key: 'department', type: 'enum', values: DEPARTMENTS },
    { key: 'priority', type: 'enum', values: TASK_PRIORITIES },
    { key: 'status', type: 'enum', values: TASK_STATUSES },
    { key: 'dueFrom', type: 'date' },
    { key: 'dueTo', type: 'date' },
  ],
  sorts: TASK_SORT_OPTIONS.map((option) => option.value),
  defaultSort: 'createdAt',
  defaultOrderForSort: defaultTaskOrder,
};

const departmentOptions = [
  { value: '', label: 'All departments' },
  ...DEPARTMENTS.map((department) => ({ value: department, label: department })),
];

const priorityOptions = [
  { value: '', label: 'All priorities' },
  ...TASK_PRIORITIES.map((priority) => ({ value: priority, label: priority })),
];

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...TASK_STATUSES.map((status) => ({ value: status, label: status })),
];

function taskColumns(returnTo, onDelete, onTransition, updatingStatusId) {
  return [
    {
      key: 'taskId',
      header: 'Task ID',
      cell: (task) => (
        <span className="whitespace-nowrap font-mono text-xs text-ink-muted">
          {task.taskId}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      cell: (task) => (
        <div className="min-w-44">
          <AppLink
            to={`/tasks/${task.id}`}
            state={{ from: returnTo }}
            className="font-semibold"
          >
            {task.title}
          </AppLink>
        </div>
      ),
    },
    {
      key: 'employee',
      header: 'Employee',
      cell: (task) => (
        <div className="min-w-36">
          <p className="font-medium text-ink">
            {task.employeeSnapshot?.fullName || 'Unavailable'}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {task.employeeSnapshot?.employeeId || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      cell: (task) => <PriorityBadge priority={task.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (task) => (
        <div className="flex min-w-36 flex-col items-start gap-2">
          <StatusBadge status={task.status} />
          <TaskStatusMenu
            task={task}
            onTransition={(status) => onTransition(task, status)}
            updating={updatingStatusId === task.id}
          />
        </div>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due date',
      cell: (task) => (
        <div className="flex min-w-28 flex-col items-start gap-1">
          <span>{formatDate(task.dueDate)}</span>
          <OverdueBadge overdue={task.isOverdue} />
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (task) => (
        <ActionMenu
          ariaLabel={`Actions for ${task.taskId}`}
          items={[
            {
              label: 'View',
              to: `/tasks/${task.id}`,
              state: { from: returnTo },
            },
            ...(!TERMINAL_TASK_STATUSES.includes(task.status)
              ? [
                  {
                    label: 'Edit',
                    to: `/tasks/${task.id}/edit`,
                    state: { from: returnTo },
                  },
                ]
              : []),
            {
              label: 'Delete',
              tone: 'danger',
              onClick: () => onDelete(task),
            },
          ]}
        />
      ),
    },
  ];
}

export default function TaskListPage() {
  const list = useListState(listConfig);
  const location = useLocation();
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [dateDraft, setDateDraft] = useState({
    dueFrom: list.filters.dueFrom,
    dueTo: list.filters.dueTo,
  });
  const [dateError, setDateError] = useState('');
  const { data, loading, error, reload } = useApiResource(
    ({ signal }) => listTasks(list.apiParams, { signal }),
    [list.queryKey],
  );
  const returnTo = `${location.pathname}${location.search}`;
  const tasks = data?.data || [];

  useEffect(() => {
    setDateDraft({
      dueFrom: list.filters.dueFrom,
      dueTo: list.filters.dueTo,
    });
  }, [list.filters.dueFrom, list.filters.dueTo]);

  useEffect(() => {
    if (
      data?.pagination &&
      list.page > 1 &&
      list.page > data.pagination.totalPages
    ) {
      list.setPage(Math.max(1, data.pagination.totalPages));
    }
  }, [data?.pagination, list.page, list.setPage]);

  function updateDateDraft(field, value) {
    setDateDraft((current) => ({ ...current, [field]: value }));
    setDateError('');
  }

  function applyDates() {
    const dueFrom = dateDraft.dueFrom.trim();
    const dueTo = dateDraft.dueTo.trim();

    if (dueFrom && !isValidDateOnly(dueFrom)) {
      setDateError('Due From must use YYYY-MM-DD format.');
      return;
    }

    if (dueTo && !isValidDateOnly(dueTo)) {
      setDateError('Due To must use YYYY-MM-DD format.');
      return;
    }

    if (dueFrom && dueTo && dueTo < dueFrom) {
      setDateError('Due To must be on or after Due From.');
      return;
    }

    setDateError('');
    list.setFilters({ dueFrom, dueTo });
  }

  function clearFilters() {
    setDateDraft({ dueFrom: '', dueTo: '' });
    setDateError('');
    list.clearFilters();
  }

  async function handleExport() {
    setExporting(true);

    try {
      await downloadTasksCsv(list.exportParams);
      toast.success('The filtered task CSV was downloaded.');
    } catch (exportError) {
      const normalized = getApiError(exportError);
      toast.error(normalized.message);
      setActionError(normalized.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setActionError('');

    try {
      await deleteTask(deleteTarget.id);
      toast.success(`${deleteTarget.taskId} was deleted.`);
      setDeleteTarget(null);

      if (data?.data.length === 1 && list.page > 1) {
        list.setPage(list.page - 1);
      } else {
        reload();
      }
    } catch (deleteError) {
      const normalized = getApiError(deleteError);
      setActionError(normalized.message);
      toast.error(normalized.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleTransition(task, status) {
    setUpdatingStatusId(task.id);
    setActionError('');

    try {
      await updateTaskStatus(task.id, status);
      toast.success(`${task.taskId} moved to ${status}.`);
      reload();
    } catch (statusError) {
      const normalized = getApiError(statusError);
      setActionError(normalized.message);
      toast.error(normalized.message);
    } finally {
      setUpdatingStatusId(null);
    }
  }

  const columns = taskColumns(
    returnTo,
    setDeleteTarget,
    handleTransition,
    updatingStatusId,
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Search and filter tasks, manage status transitions, and export the active view."
        actions={
          <>
            <Button variant="secondary" loading={exporting} onClick={handleExport}>
              <Icon name="download" className="h-4 w-4" />
              Export CSV
            </Button>
            <LinkButton to="/tasks/new" state={{ from: returnTo }}>
              <Icon name="plus" className="h-4 w-4" />
              Add task
            </LinkButton>
          </>
        }
      />

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <DebouncedSearchInput
              id="task-search"
              value={list.search}
              onSearch={list.setSearch}
              placeholder="Search task title or employee name"
            />
          </div>

          <div className="lg:col-span-2">
            <FormField id="task-department-filter" label="Department">
              <Select
                value={list.filters.department}
                onChange={(value) => list.setFilter('department', value)}
                options={departmentOptions}
              />
            </FormField>
          </div>

          <div className="lg:col-span-2">
            <FormField id="task-priority-filter" label="Priority">
              <Select
                value={list.filters.priority}
                onChange={(value) => list.setFilter('priority', value)}
                options={priorityOptions}
              />
            </FormField>
          </div>

          <div className="lg:col-span-2">
            <FormField id="task-status-filter" label="Status">
              <Select
                value={list.filters.status}
                onChange={(value) => list.setFilter('status', value)}
                options={statusOptions}
              />
            </FormField>
          </div>

          <div className="lg:col-span-2">
            <FormField id="task-sort" label="Sort by">
              <Select
                value={list.sort}
                onChange={list.setSort}
                options={TASK_SORT_OPTIONS}
              />
            </FormField>
          </div>
        </div>

        <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <FormField id="task-due-from" label="Due from">
              <DateInput
                value={dateDraft.dueFrom}
                onChange={(event) => updateDateDraft('dueFrom', event.target.value)}
              />
            </FormField>
          </div>

          <div className="lg:col-span-3">
            <FormField id="task-due-to" label="Due to">
              <DateInput
                value={dateDraft.dueTo}
                onChange={(event) => updateDateDraft('dueTo', event.target.value)}
              />
            </FormField>
          </div>

          <div className="lg:col-span-2">
            <Button className="w-full" variant="secondary" onClick={applyDates}>
              Apply dates
            </Button>
          </div>

          <div className="lg:col-span-2">
            <Button
              className="w-full"
              variant="secondary"
              aria-label={`Sort direction: ${list.order === 'asc' ? 'ascending' : 'descending'}`}
              onClick={() =>
                list.setOrder(list.order === 'asc' ? 'desc' : 'asc')
              }
            >
              <Icon
                name={list.order === 'asc' ? 'chevronUp' : 'chevronDown'}
                className="h-4 w-4"
              />
              {list.order === 'asc' ? 'Ascending' : 'Descending'}
            </Button>
          </div>

          <div className="lg:col-span-2 lg:flex lg:justify-end">
            {list.hasActiveFilters ? (
              <Button className="w-full lg:w-auto" variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>

        {dateError ? (
          <p className="mt-3 text-sm font-medium text-rust" role="alert">
            {dateError}
          </p>
        ) : null}
      </section>

      {actionError ? (
        <InlineAlert className="mt-4" variant="error">
          <div className="flex items-start justify-between gap-3">
            <span>{actionError}</span>
            <IconButton
              label="Dismiss error"
              className="shrink-0 text-current"
              onClick={() => setActionError('')}
            >
              <Icon name="close" className="h-4 w-4" />
            </IconButton>
          </div>
        </InlineAlert>
      ) : null}

      <div className="mt-5">
        {loading ? <LoadingSkeleton rows={8} /> : null}

        {!loading && error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : null}

        {!loading && !error ? (
          <DataTable
            caption="Tasks"
            columns={columns}
            rows={tasks}
            rowKey={(task) => task.id}
            emptyState={
              <EmptyState
                title={
                  list.hasActiveFilters
                    ? 'No tasks match your filters'
                    : 'No tasks yet'
                }
                description={
                  list.hasActiveFilters
                    ? 'Try a different search or clear the current filters.'
                    : 'Create the first task to begin tracking assignments and deadlines.'
                }
                action={
                  list.hasActiveFilters ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <LinkButton to="/tasks/new">Add task</LinkButton>
                  )
                }
              />
            }
          />
        ) : null}

        {!loading && !error && data?.pagination ? (
          <Pagination
            page={data.pagination.page}
            limit={data.pagination.limit}
            total={data.pagination.total}
            totalPages={data.pagination.totalPages}
            onPageChange={list.setPage}
          />
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.taskId || 'task'}?`}
        description="This permanently removes the task. If it is Todo or In Progress, the employee's active task count is reduced. The employee record is unchanged."
        confirmLabel="Delete task"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </>
  );
}
