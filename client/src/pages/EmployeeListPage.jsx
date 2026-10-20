import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getApiError } from '../api/client';
import { deleteEmployee, listEmployees } from '../api/employees';
import ActionMenu from '../components/common/ActionMenu';
import AppLink from '../components/common/AppLink';
import Button, { LinkButton } from '../components/common/Button';
import ConfirmDialog from '../components/common/ConfirmDialog';
import DataTable from '../components/common/DataTable';
import DebouncedSearchInput from '../components/common/DebouncedSearchInput';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import FormField from '../components/common/FormField';
import Icon from '../components/common/Icon';
import IconButton from '../components/common/IconButton';
import InlineAlert from '../components/common/InlineAlert';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import PageHeader from '../components/common/PageHeader';
import Pagination from '../components/common/Pagination';
import Select from '../components/common/Select';
import StatusBadge from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import { useApiResource } from '../hooks/useApiResource';
import { useListState } from '../hooks/useListState';
import {
  DEPARTMENTS,
  EMPLOYEE_SORT_OPTIONS,
  EMPLOYEE_STATUSES,
} from '../utils/constants';
import { formatDate } from '../utils/date';

const listConfig = {
  filters: [
    { key: 'department', type: 'enum', values: DEPARTMENTS },
    { key: 'status', type: 'enum', values: EMPLOYEE_STATUSES },
  ],
  sorts: EMPLOYEE_SORT_OPTIONS.map((option) => option.value),
  defaultSort: 'fullName',
  defaultOrderForSort: () => 'asc',
};

const departmentOptions = [
  { value: '', label: 'All departments' },
  ...DEPARTMENTS.map((department) => ({ value: department, label: department })),
];

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...EMPLOYEE_STATUSES.map((status) => ({ value: status, label: status })),
];

function employeeColumns(returnTo, onDelete) {
  return [
    {
      key: 'employee',
      header: 'Employee',
      cell: (employee) => (
        <div>
          <AppLink
            to={`/employees/${employee.id}`}
            state={{ from: returnTo }}
            className="font-semibold"
          >
            {employee.fullName}
          </AppLink>
          <p className="mt-1 text-xs text-ink-muted">{employee.role}</p>
        </div>
      ),
    },
    {
      key: 'employeeId',
      header: 'Employee ID',
      cell: (employee) => (
        <span className="font-mono text-xs text-ink-muted">{employee.employeeId}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (employee) => employee.email,
    },
    {
      key: 'department',
      header: 'Department',
      cell: (employee) => employee.department,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (employee) => <StatusBadge status={employee.status} />,
    },
    {
      key: 'joiningDate',
      header: 'Joining date',
      cell: (employee) => formatDate(employee.joiningDate),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (employee) => (
        <ActionMenu
          ariaLabel={`Actions for ${employee.fullName}`}
          items={[
            {
              label: 'View',
              to: `/employees/${employee.id}`,
              state: { from: returnTo },
            },
            {
              label: 'Edit',
              to: `/employees/${employee.id}/edit`,
              state: { from: returnTo },
            },
            {
              label: 'Delete',
              tone: 'danger',
              onClick: () => onDelete(employee),
            },
          ]}
        />
      ),
    },
  ];
}

export default function EmployeeListPage() {
  const list = useListState(listConfig);
  const location = useLocation();
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const { data, loading, error, reload } = useApiResource(
    ({ signal }) => listEmployees(list.apiParams, { signal }),
    [list.queryKey],
  );
  const returnTo = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (
      data?.pagination &&
      list.page > 1 &&
      list.page > data.pagination.totalPages
    ) {
      list.setPage(Math.max(1, data.pagination.totalPages));
    }
  }, [data?.pagination, list.page, list.setPage]);

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setActionError('');

    try {
      await deleteEmployee(deleteTarget.id);
      toast.success(`${deleteTarget.fullName} was deleted.`);
      setDeleteTarget(null);

      if (data?.data.length === 1 && list.page > 1) {
        list.setPage(list.page - 1);
      } else {
        reload();
      }
    } catch (apiError) {
      const normalized = getApiError(apiError);
      setActionError(normalized.message);
      toast.error(normalized.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const columns = employeeColumns(returnTo, setDeleteTarget);
  const employees = data?.data || [];

  return (
    <>
      <PageHeader
        title="Employees"
        description="Search, filter, and manage the employee directory."
        actions={
          <LinkButton to="/employees/new" state={{ from: returnTo }}>
            <Icon name="plus" className="h-4 w-4" />
            Add employee
          </LinkButton>
        }
      />

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <DebouncedSearchInput
              id="employee-search"
              value={list.search}
              onSearch={list.setSearch}
              placeholder="Search name, employee ID, or email"
            />
          </div>

          <div className="lg:col-span-2">
            <FormField id="employee-department-filter" label="Department">
              <Select
                value={list.filters.department}
                onChange={(value) => list.setFilter('department', value)}
                options={departmentOptions}
              />
            </FormField>
          </div>

          <div className="lg:col-span-2">
            <FormField id="employee-status-filter" label="Status">
              <Select
                value={list.filters.status}
                onChange={(value) => list.setFilter('status', value)}
                options={statusOptions}
              />
            </FormField>
          </div>

          <div className="lg:col-span-2">
            <FormField id="employee-sort" label="Sort by">
              <Select
                value={list.sort}
                onChange={list.setSort}
                options={EMPLOYEE_SORT_OPTIONS}
              />
            </FormField>
          </div>

          <div className="flex items-end lg:col-span-2">
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
        </div>

        {list.hasActiveFilters ? (
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="ghost" onClick={list.clearFilters}>
              Clear filters
            </Button>
          </div>
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
            caption="Employees"
            columns={columns}
            rows={employees}
            rowKey={(employee) => employee.id}
            emptyState={
              <EmptyState
                title={
                  list.hasActiveFilters
                    ? 'No employees match your filters'
                    : 'No employees yet'
                }
                description={
                  list.hasActiveFilters
                    ? 'Try a different search or clear the current filters.'
                    : 'Add your first employee to begin assigning tasks.'
                }
                action={
                  list.hasActiveFilters ? (
                    <Button variant="secondary" onClick={list.clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <LinkButton to="/employees/new">Add employee</LinkButton>
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
        title={`Delete ${deleteTarget?.fullName || 'employee'}?`}
        description="The employee can only be deleted when no Todo or In Progress tasks are assigned. Completed and Cancelled task snapshots are preserved."
        confirmLabel="Delete employee"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </>
  );
}
