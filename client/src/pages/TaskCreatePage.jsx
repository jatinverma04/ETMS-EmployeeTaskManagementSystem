import { useLocation, useNavigate } from 'react-router-dom';
import { createTask } from '../api/tasks';
import Breadcrumbs from '../components/common/Breadcrumbs';
import PageHeader from '../components/common/PageHeader';
import { useToast } from '../components/common/ToastProvider';
import TaskForm from '../components/tasks/TaskForm';

export default function TaskCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const backTo = location.state?.from || '/tasks';

  async function handleSubmit(payload) {
    const task = await createTask(payload);
    toast.success(`${task.taskId} was created.`);
    navigate(`/tasks/${task.id}`, { state: { from: backTo } });
  }

  return (
    <>
      <PageHeader
        title="Add task"
        description="Create a task, assign it to an employee, and set its schedule."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Tasks', to: backTo },
              { label: 'Add task' },
            ]}
          />
        }
      />

      <TaskForm
        mode="create"
        onSubmit={handleSubmit}
        cancelTo={backTo}
      />
    </>
  );
}
