import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { deleteEmployee, getEmployee } from '../api/employees';
import { getApiError } from '../api/client';
import Breadcrumbs from '../components/common/Breadcrumbs';
import Button, { LinkButton } from '../components/common/Button';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ErrorState from '../components/common/ErrorState';
import Icon from '../components/common/Icon';
import IconButton from '../components/common/IconButton';
import InlineAlert from '../components/common/InlineAlert';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import { useApiResource } from '../hooks/useApiResource';
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

function DetailSection({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

export default function EmployeeViewPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const { data: employee, loading, error, reload } = useApiResource(
    ({ signal }) => getEmployee(id, { signal }),
    [id],
  );
  const backTo = location.state?.from || '/employees';
  const viewState = { from: backTo };
  const tasksLink = {
    pathname: '/tasks',
    search: new URLSearchParams({ search: employee?.fullName || '' }).toString(),
  };

  async function handleDelete() {
    setDeleting(true);
    setActionError('');

    try {
      await deleteEmployee(id);
      toast.success(`${employee.fullName} was deleted.`);
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
        title={employee?.fullName || 'Employee'}
        description={
          employee ? `${employee.employeeId} · ${employee.role}` : 'Employee details'
        }
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Employees', to: backTo },
              { label: employee?.fullName || 'Employee' },
            ]}
          />
        }
        actions={
          employee ? (
            <>
              <LinkButton to={backTo} variant="ghost">
                <Icon name="arrowLeft" className="h-4 w-4" />
                Back
              </LinkButton>
              <LinkButton
                to={`/employees/${employee.id}/edit`}
                state={viewState}
                variant="secondary"
              >
                <Icon name="edit" className="h-4 w-4" />
                Edit
              </LinkButton>
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
          title={error.status === 404 ? 'Employee not found' : 'Unable to load employee'}
          message={error.message}
          onRetry={reload}
        />
      ) : null}

      {!loading && employee ? (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <DetailSection
              title="Identity"
              description="Core employee identification."
            >
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailItem label="Employee ID">{employee.employeeId}</DetailItem>
                <DetailItem label="Full name">{employee.fullName}</DetailItem>
                <DetailItem label="Status">
                  <StatusBadge status={employee.status} />
                </DetailItem>
              </dl>
            </DetailSection>

            <DetailSection title="Contact" description="Direct contact details.">
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailItem label="Email">{employee.email}</DetailItem>
                <DetailItem label="Phone">{employee.phone}</DetailItem>
              </dl>
            </DetailSection>

            <DetailSection
              title="Employment"
              description="Department, role, and joining information."
            >
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailItem label="Department">{employee.department}</DetailItem>
                <DetailItem label="Role">{employee.role}</DetailItem>
                <DetailItem label="Joining date">
                  {formatDate(employee.joiningDate)}
                </DetailItem>
              </dl>
            </DetailSection>

            <DetailSection
              title="Leave"
              description="Recorded leave period when the employee is on leave."
            >
              {employee.status === 'On Leave' ? (
                <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                  <DetailItem label="Leave start">
                    {formatDate(employee.leaveStart)}
                  </DetailItem>
                  <DetailItem label="Leave end">
                    {formatDate(employee.leaveEnd)}
                  </DetailItem>
                </dl>
              ) : (
                <p className="mt-5 text-sm text-ink-muted">
                  This employee is not currently on leave.
                </p>
              )}
            </DetailSection>
          </div>

          <DetailSection
            title="Skills"
            description="Capabilities recorded for this employee."
          >
            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              {employee.skills.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Skills">
                  {employee.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">No skills recorded.</p>
              )}
              <LinkButton className="shrink-0" to={tasksLink} variant="secondary">
                View employee tasks
              </LinkButton>
            </div>
          </DetailSection>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${employee?.fullName || 'employee'}?`}
        description="The employee can only be deleted when no Todo or In Progress tasks are assigned. Completed and Cancelled task snapshots are preserved."
        confirmLabel="Delete employee"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleting}
      />
    </>
  );
}
