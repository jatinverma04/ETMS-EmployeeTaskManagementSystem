import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  deleteTask,
  getTask,
  updateTaskStatus,
} from '../api/tasks';
import { getApiError } from '../api/client';
import Breadcrumbs from '../components/common/Breadcrumbs';
import Button, { LinkButton } from '../components/common/Button';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ErrorState from '../components/common/ErrorState';
import Icon from '../components/common/Icon';
import IconButton from '../components/common/IconButton';
import InlineAlert from '../components/common/InlineAlert';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import OverdueBadge from '../components/common/OverdueBadge';
import PageHeader from '../components/common/PageHeader';
import PriorityBadge from '../components/common/PriorityBadge';
import StatusBadge from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import { useApiResource } from '../hooks/useApiResource';
import {
  TASK_STATUS_TRANSITIONS,
  TERMINAL_TASK_STATUSES,
} from '../utils/constants';
import { formatDate } from '../utils/date';

function DetailItem({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-ink">{children || '—'}</dd>
    </div>
  );
}

export default function TaskViewPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState('');
  const [actionError, setActionError] = useState('');
  const { data: task, loading, error, reload } = useApiResource(
    ({ signal }) => getTask(id, { signal }),
    [id],
  );
  const backTo = location.state?.from || '/tasks';
  const viewState = { from: backTo };
  const nextStatuses = task ? TASK_STATUS_TRANSITIONS[task.status] || [] : [];

  async function handleStatusChange(status) {
    setUpdatingStatus(status);
    setActionError('');

    try {
      await updateTaskStatus(id, status);
      toast.success(`${task.taskId} moved to ${status}.`);
      reload();
    } catch (statusError) {
      const normalized = getApiError(statusError);
      setActionError(normalized.message);
      toast.error(normalized.message);
    } finally {
      setUpdatingStatus('');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setActionError('');

    try {
      await deleteTask(id);
      toast.success(`${task.taskId} was deleted.`);
      navigate(backTo);
    } catch (deleteError) {
      const normalized = getApiError(deleteError);
      setActionError(normalized.message);
      toast.error(normalized.message);
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={task?.title || 'Task'}
        description={
          task ? `${task.taskId} · ${task.department}` : 'Task details'
        }
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Tasks', to: backTo },
              { label: task?.taskId || 'Task' },
            ]}
          />
        }
        actions={
          task ? (
            <>
              <LinkButton to={backTo} variant="ghost">
                <Icon name="arrowLeft" className="h-4 w-4" />
                Back
              </LinkButton>
              {!TERMINAL_TASK_STATUSES.includes(task.status) ? (
                <LinkButton
                  to={`/tasks/${task.id}/edit`}
                  state={viewState}
                  variant="secondary"
                >
                  <Icon name="edit" className="h-4 w-4" />
                  Edit
                </LinkButton>
              ) : null}
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                <Icon name="trash" className="h-4 w-4" />
                Delete
              </Button>
            </>
          ) : null
        }
      />

      {actionError ? (
        <InlineAlert className="mb-5" variant="error">
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

      {loading ? <LoadingSkeleton rows={7} /> : null}

      {!loading && error ? (
        <ErrorState
          title={error.status === 404 ? 'Task not found' : 'Unable to load task'}
          message={error.message}
          onRetry={reload}
        />
      ) : null}

      {!loading && task ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">Status</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Only valid next transitions are available.
                </p>
              </div>
              <StatusBadge status={task.status} className="w-fit" />
            </div>

            {nextStatuses.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {nextStatuses.map((status) => (
                  <Button
                    key={status}
                    variant={status === 'Cancelled' ? 'secondary' : 'primary'}
                    loading={updatingStatus === status}
                    disabled={Boolean(updatingStatus)}
                    onClick={() => handleStatusChange(status)}
                  >
                    Move to {status}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-ink-muted">
                This task is in a final status and cannot be transitioned further.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-ink">Description</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-ink">
              {task.description}
            </p>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-ink">Assignment</h2>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailItem label="Employee">
                  {task.employeeSnapshot?.fullName || 'Unavailable'}
                </DetailItem>
                <DetailItem label="Employee ID">
                  <span className="font-mono text-xs">
                    {task.employeeSnapshot?.employeeId || '—'}
                  </span>
                </DetailItem>
                <DetailItem label="Email">
                  {task.employeeSnapshot?.email || '—'}
                </DetailItem>
                <DetailItem label="Employee department">
                  {task.employeeSnapshot?.department || '—'}
                </DetailItem>
              </dl>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
              <h2 className="text-base font-semibold text-ink">Task details</h2>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailItem label="Department">{task.department}</DetailItem>
                <DetailItem label="Priority">
                  <PriorityBadge priority={task.priority} />
                </DetailItem>
                <DetailItem label="Start date">
                  {formatDate(task.startDate)}
                </DetailItem>
                <DetailItem label="Due date">
                  <span className="flex flex-wrap items-center gap-2">
                    {formatDate(task.dueDate)}
                    <OverdueBadge overdue={task.isOverdue} />
                  </span>
                </DetailItem>
                <DetailItem label="Created">
                  {formatDate(task.createdAt)}
                </DetailItem>
                <DetailItem label="Completed">
                  {formatDate(task.completedDate)}
                </DetailItem>
              </dl>
            </section>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${task?.taskId || 'task'}?`}
        description="This permanently removes the task. If it is Todo or In Progress, the employee's active task count is reduced. The employee record is unchanged."
        confirmLabel="Delete task"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleting}
      />
    </>
  );
}
