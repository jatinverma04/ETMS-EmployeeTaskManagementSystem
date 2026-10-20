import ErrorState from '../components/common/ErrorState';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import PageHeader from '../components/common/PageHeader';
import EmployeeSummary from '../components/dashboard/EmployeeSummary';
import TaskSummary from '../components/dashboard/TaskSummary';
import WorkloadTable from '../components/dashboard/WorkloadTable';
import { getDashboard } from '../api/dashboard';
import { useApiResource } from '../hooks/useApiResource';

export default function DashboardPage() {
  const { data, loading, error, reload } = useApiResource(
    ({ signal }) => getDashboard({ signal }),
    [],
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A live view of employees, tasks, overdue work, and current workload."
      />

      {loading ? (
        <div className="space-y-5">
          <LoadingSkeleton rows={1} />
          <LoadingSkeleton rows={2} />
          <LoadingSkeleton rows={6} />
        </div>
      ) : null}

      {!loading && error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : null}

      {!loading && data ? (
        <div className="space-y-8">
          <EmployeeSummary counts={data.employees} />
          <TaskSummary counts={data.tasks} />
          <WorkloadTable workload={data.workload} />
        </div>
      ) : null}
    </>
  );
}
