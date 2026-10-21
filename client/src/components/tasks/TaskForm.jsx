import { useState } from 'react';
import { getApiError } from '../../api/client';
import { listAllEmployees } from '../../api/employees';
import { DEPARTMENTS, TASK_PRIORITIES } from '../../utils/constants';
import { validateTask } from '../../utils/validation';
import { useApiResource } from '../../hooks/useApiResource';
import Button, { LinkButton } from '../common/Button';
import DateInput from '../common/DateInput';
import FormError from '../common/FormError';
import FormField from '../common/FormField';
import InlineAlert from '../common/InlineAlert';
import Select from '../common/Select';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import { useToast } from '../common/ToastProvider';

const emptyTaskValues = Object.freeze({
  title: '',
  description: '',
  assignedEmployee: '',
  department: '',
  priority: 'Medium',
  startDate: '',
  dueDate: '',
});

function taskToFormValues(task) {
  return {
    title: task.title,
    description: task.description,
    assignedEmployee: task.assignedEmployee,
    department: task.department,
    priority: task.priority,
    startDate: task.startDate || '',
    dueDate: task.dueDate || '',
  };
}

const departmentOptions = DEPARTMENTS.map((department) => ({
  value: department,
  label: department,
}));

const priorityOptions = TASK_PRIORITIES.map((priority) => ({
  value: priority,
  label: priority,
}));

function focusFirstError(errors) {
  const firstField = Object.keys(errors)[0];

  if (firstField) {
    window.requestAnimationFrame(() => document.getElementById(firstField)?.focus());
  }
}

function employeeOption(employee) {
  return {
    value: employee.id,
    label: employee.fullName,
    description: `${employee.employeeId} · ${employee.department} · ${employee.status}`,
    disabled: employee.status === 'Inactive',
  };
}

export default function TaskForm({
  mode,
  initialTask,
  onSubmit,
  cancelTo,
  cancelState,
}) {
  const [values, setValues] = useState(
    initialTask ? taskToFormValues(initialTask) : emptyTaskValues,
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const {
    data: employees,
    loading: employeesLoading,
    error: employeesError,
    reload: reloadEmployees,
  } = useApiResource(({ signal }) => listAllEmployees({ signal }), []);

  const employeeList = employees || [];
  const selectedEmployee = employeeList.find(
    (employee) => employee.id === values.assignedEmployee,
  );
  const selectedSnapshot = initialTask?.employeeSnapshot;
  const options = employeeList.map(employeeOption);

  if (
    initialTask &&
    !options.some((option) => option.value === initialTask.assignedEmployee)
  ) {
    options.unshift({
      value: initialTask.assignedEmployee,
      label: selectedSnapshot?.fullName || 'Former employee',
      description: selectedSnapshot
        ? `${selectedSnapshot.employeeId} · ${selectedSnapshot.department} · No longer available`
        : 'This employee is no longer available.',
      disabled: true,
    });
  }

  const hasSelectableEmployee = employeeList.some(
    (employee) => employee.status !== 'Inactive',
  );
  const hasUsableEmployees = hasSelectableEmployee || Boolean(initialTask);

  function clearFieldError(field) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setFormError('');
    clearFieldError(field);
  }

  function updateEmployee(employeeId) {
    const employee = employeeList.find((entry) => entry.id === employeeId);
    setValues((current) => ({
      ...current,
      assignedEmployee: employeeId,
      department: current.department || employee?.department || '',
    }));
    setFormError('');
    clearFieldError('assignedEmployee');
  }

  function buildCreatePayload() {
    return {
      title: values.title.trim(),
      description: values.description.trim(),
      assignedEmployee: values.assignedEmployee,
      department: values.department,
      priority: values.priority,
      startDate: values.startDate,
      dueDate: values.dueDate,
    };
  }

  function buildUpdatePayload() {
    const initial = taskToFormValues(initialTask);
    const normalized = buildCreatePayload();
    const payload = {};

    for (const [key, value] of Object.entries(normalized)) {
      if (value !== initial[key]) {
        payload[key] = value;
      }
    }

    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const validationErrors = validateTask(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFormError('Please review the highlighted fields.');
      focusFirstError(validationErrors);
      return;
    }

    const payload = mode === 'create' ? buildCreatePayload() : buildUpdatePayload();

    if (mode === 'edit' && Object.keys(payload).length === 0) {
      setFormError('No changes to save.');
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormError('');

    try {
      await onSubmit(payload);
    } catch (error) {
      const apiError = getApiError(error);
      setErrors(apiError.errors);
      setFormError(apiError.message);
      toast.error(apiError.message);
      focusFirstError(apiError.errors);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <FormError message={formError} />

      {employeesError ? (
        <InlineAlert variant="error">
          <span className="block">{employeesError.message}</span>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            onClick={reloadEmployees}
          >
            Retry employees
          </Button>
        </InlineAlert>
      ) : null}

      {!employeesLoading && !employeesError && !hasUsableEmployees ? (
        <InlineAlert variant="info">
          <span className="block">
            Add or reactivate an employee before creating a task.
          </span>
          <LinkButton className="mt-3" size="sm" to="/employees/new" variant="secondary">
            Add employee
          </LinkButton>
        </InlineAlert>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-ink">Task details</h2>
        <div className="mt-5 grid gap-4">
          <FormField id="title" label="Title" required error={errors.title}>
            <TextInput
              value={values.title}
              maxLength={150}
              onChange={(event) => updateField('title', event.target.value)}
            />
          </FormField>

          <FormField
            id="description"
            label="Description"
            required
            error={errors.description}
            hint={`${values.description.trim().length}/2,000 characters`}
          >
            <TextArea
              value={values.description}
              rows={5}
              maxLength={2000}
              onChange={(event) => updateField('description', event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-ink">Assignment and schedule</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FormField
            id="assignedEmployee"
            label="Assigned Employee"
            required
            error={errors.assignedEmployee}
            hint={
              selectedEmployee?.status === 'On Leave'
                ? 'On Leave employees are only assignable when Start Date is outside their leave period.'
                : employeesLoading
                  ? 'Loading employees…'
                  : 'Inactive employees cannot be selected.'
            }
            className="sm:col-span-2"
          >
            <Select
              value={values.assignedEmployee}
              onChange={updateEmployee}
              options={options}
              placeholder={employeesLoading ? 'Loading employees…' : 'Select employee'}
              disabled={employeesLoading || Boolean(employeesError)}
              showSelectedDescription
            />
          </FormField>

          <FormField id="department" label="Department" required error={errors.department}>
            <Select
              value={values.department}
              onChange={(value) => updateField('department', value)}
              options={departmentOptions}
              placeholder="Select department"
            />
          </FormField>

          <FormField id="priority" label="Priority" required error={errors.priority}>
            <Select
              value={values.priority}
              onChange={(value) => updateField('priority', value)}
              options={priorityOptions}
            />
          </FormField>

          <FormField
            id="startDate"
            label="Start Date"
            required
            error={errors.startDate}
            hint="Use YYYY-MM-DD."
          >
            <DateInput
              value={values.startDate}
              onChange={(event) => updateField('startDate', event.target.value)}
            />
          </FormField>

          <FormField
            id="dueDate"
            label="Due Date"
            required
            error={errors.dueDate}
            hint="Use YYYY-MM-DD and keep it on or after Start Date."
          >
            <DateInput
              value={values.dueDate}
              onChange={(event) => updateField('dueDate', event.target.value)}
            />
          </FormField>
        </div>

        {selectedEmployee?.status === 'Inactive' ? (
          <InlineAlert className="mt-5" variant="info">
            This employee is inactive. The existing assignment can remain, but the server
            will reject new assignments to an inactive employee.
          </InlineAlert>
        ) : null}

        <p className="mt-5 text-sm text-ink-muted">
          {mode === 'create'
            ? 'New tasks start as Todo. Status is managed from the task view.'
            : 'Status is managed from the task view and is not editable here.'}
        </p>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LinkButton to={cancelTo} state={cancelState} variant="secondary">
          Cancel
        </LinkButton>
        <Button type="submit" loading={submitting} disabled={!hasUsableEmployees}>
          {mode === 'create' ? 'Create task' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
