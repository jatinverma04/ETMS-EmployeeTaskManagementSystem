import AppLink from '../common/AppLink';
import DataTable from '../common/DataTable';
import EmptyState from '../common/EmptyState';

const columns = [
  {
    key: 'employee',
    header: 'Employee',
    cell: (row) => (
      <div>
        <AppLink to={`/employees/${row.id}`} state={{ from: '/dashboard' }}>
          {row.fullName}
        </AppLink>
        <p className="mt-1 font-mono text-xs text-ink-muted">{row.employeeId}</p>
      </div>
    ),
  },
  {
    key: 'department',
    header: 'Department',
    cell: (row) => row.department,
  },
  {
    key: 'activeTasks',
    header: 'Active tasks',
    cell: (row) => (
      <span className="font-semibold tabular-nums">{row.activeTasks}</span>
    ),
  },
];

export default function WorkloadTable({ workload }) {
  return (
    <section aria-labelledby="workload-heading">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="workload-heading" className="text-base font-semibold text-ink">
            Employee workload
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Todo and In Progress tasks by employee.
          </p>
        </div>
      </div>

      <DataTable
        caption="Employee workload"
        columns={columns}
        rows={workload}
        rowKey={(row) => row.id}
        emptyState={
          <EmptyState
            title="No employees yet"
            description="Add employees to start assigning tasks and tracking workload."
          />
        }
      />
    </section>
  );
}
