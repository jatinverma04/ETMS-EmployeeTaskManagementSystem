import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getTask, updateTask } from '../api/tasks';
import Breadcrumbs from '../components/common/Breadcrumbs';
import ErrorState from '../components/common/ErrorState';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import PageHeader from '../components/common/PageHeader';
import { useToast } from '../components/common/ToastProvider';
import TaskForm from '../components/tasks/TaskForm';
import { useApiResource } from '../hooks/useApiResource';
import { TERMINAL_TASK_STATUSES } from '../utils/constants';

export default function TaskEditPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: task, loading, error, reload } = useApiResource(
    ({ signal }) => getTask(id, { signal }),
    [id],
  );
  const backTo = location.state?.from || '/tasks';
  const viewTo = `/tasks/${id}`;
  const viewState = { from: backTo };

  async function handleSubmit(payload) {
    const updated = await updateTask(id, payload);
    toast.success(`${updated.taskId} was updated.`);
    navigate(viewTo, { state: viewState });
  }

  if (task && TERMINAL_TASK_STATUSES.includes(task.status)) {
    return <Navigate to={viewTo} state={location.state} replace />;
  }

  return (
    <>
      <PageHeader
        title={task ? `Edit ${task.taskId}` : 'Edit task'}
        description="Update task details or reassign the task. Status changes happen from the task view."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Tasks', to: backTo },
              { label: task?.taskId || 'Task', to: viewTo, state: viewState },
              { label: 'Edit' },
            ]}
          />
        }
      />

      {loading ? <LoadingSkeleton rows={7} /> : null}

      {!loading && error ? (
        <ErrorState
          title={error.status === 404 ? 'Task not found' : 'Unable to load task'}
          message={error.message}
          onRetry={reload}
        />
      ) : null}

      {!loading && task ? (
        <TaskForm
          key={task.id}
          mode="edit"
          initialTask={task}
          onSubmit={handleSubmit}
          cancelTo={viewTo}
          cancelState={viewState}
        />
      ) : null}
    </>
  );
}
