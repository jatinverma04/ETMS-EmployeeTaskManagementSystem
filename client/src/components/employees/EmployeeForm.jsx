import { useState } from 'react';
import { getApiError } from '../../api/client';
import { DEPARTMENTS, EMPLOYEE_STATUSES } from '../../utils/constants';
import { normalizeSkills, validateEmployee } from '../../utils/validation';
import Button, { LinkButton } from '../common/Button';
import DateInput from '../common/DateInput';
import { EmailInput, PhoneInput } from '../common/TextInput';
import FormError from '../common/FormError';
import FormField from '../common/FormField';
import Select from '../common/Select';
import TagInput from '../common/TagInput';
import TextInput from '../common/TextInput';
import { useToast } from '../common/ToastProvider';

export const emptyEmployeeValues = Object.freeze({
  employeeId: '',
  fullName: '',
  email: '',
  phone: '',
  department: '',
  role: '',
  joiningDate: '',
  status: 'Active',
  skills: [],
  leaveStart: '',
  leaveEnd: '',
});

export function employeeToFormValues(employee) {
  return {
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    role: employee.role,
    joiningDate: employee.joiningDate || '',
    status: employee.status,
    skills: employee.skills || [],
    leaveStart: employee.leaveStart || '',
    leaveEnd: employee.leaveEnd || '',
  };
}

const departmentOptions = DEPARTMENTS.map((department) => ({
  value: department,
  label: department,
}));

const statusOptions = EMPLOYEE_STATUSES.map((status) => ({
  value: status,
  label: status,
}));

function focusFirstError(errors) {
  const firstField = Object.keys(errors)[0];

  if (firstField) {
    window.requestAnimationFrame(() => document.getElementById(firstField)?.focus());
  }
}

export default function EmployeeForm({
  mode,
  initialValues = emptyEmployeeValues,
  onSubmit,
  cancelTo,
  cancelState,
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

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

  function updateStatus(status) {
    setValues((current) => ({
      ...current,
      status,
      leaveStart: status === 'On Leave' ? current.leaveStart : '',
      leaveEnd: status === 'On Leave' ? current.leaveEnd : '',
    }));
    setFormError('');
    clearFieldError('status');
    clearFieldError('leaveStart');
    clearFieldError('leaveEnd');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const validationErrors = validateEmployee(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFormError('Please review the highlighted fields.');
      focusFirstError(validationErrors);
      return;
    }

    const payload = {
      employeeId: values.employeeId.trim().toUpperCase(),
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      department: values.department,
      role: values.role.trim(),
      joiningDate: values.joiningDate,
      status: values.status,
      skills: normalizeSkills(values.skills),
      leaveStart: values.status === 'On Leave' ? values.leaveStart : null,
      leaveEnd: values.status === 'On Leave' ? values.leaveEnd : null,
    };

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

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-ink">Identity and contact</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FormField
            id="employeeId"
            label="Employee ID"
            required
            error={errors.employeeId}
            hint="2-30 characters."
          >
            <TextInput
              value={values.employeeId}
              placeholder="EMP-001"
              autoComplete="off"
              maxLength={30}
              onChange={(event) => updateField('employeeId', event.target.value)}
            />
          </FormField>

          <FormField id="fullName" label="Full Name" required error={errors.fullName}>
            <TextInput
              value={values.fullName}
              autoComplete="name"
              maxLength={100}
              onChange={(event) => updateField('fullName', event.target.value)}
            />
          </FormField>

          <FormField id="email" label="Email" required error={errors.email}>
            <EmailInput
              value={values.email}
              autoComplete="email"
              onChange={(event) => updateField('email', event.target.value)}
            />
          </FormField>

          <FormField
            id="phone"
            label="Phone"
            required
            error={errors.phone}
            hint="7-15 digits; spaces, +, -, and parentheses are allowed."
          >
            <PhoneInput
              value={values.phone}
              autoComplete="tel"
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-ink">Employment</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FormField id="department" label="Department" required error={errors.department}>
            <Select
              value={values.department}
              onChange={(value) => updateField('department', value)}
              options={departmentOptions}
              placeholder="Select department"
            />
          </FormField>

          <FormField id="role" label="Role" required error={errors.role}>
            <TextInput
              value={values.role}
              autoComplete="organization-title"
              maxLength={80}
              onChange={(event) => updateField('role', event.target.value)}
            />
          </FormField>

          <FormField
            id="joiningDate"
            label="Joining Date"
            required
            error={errors.joiningDate}
            hint="Use YYYY-MM-DD."
          >
            <DateInput
              value={values.joiningDate}
              onChange={(event) => updateField('joiningDate', event.target.value)}
            />
          </FormField>

          <FormField id="status" label="Status" required error={errors.status}>
            <Select
              value={values.status}
              onChange={updateStatus}
              options={statusOptions}
            />
          </FormField>

          <FormField
            id="skills"
            label="Skills"
            error={errors.skills}
            hint="Add up to 20 skills. Press Enter or type a comma after each skill."
            className="sm:col-span-2"
          >
            <TagInput
              value={values.skills}
              onChange={(skills) => updateField('skills', skills)}
            />
          </FormField>
        </div>
      </section>

      {values.status === 'On Leave' ? (
        <section className="rounded-2xl border border-amber/30 bg-amber-soft p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-ink">Leave period</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Leave dates are required while the employee status is On Leave.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField
              id="leaveStart"
              label="Leave Start"
              required
              error={errors.leaveStart}
              hint="Use YYYY-MM-DD."
            >
              <DateInput
                value={values.leaveStart}
                onChange={(event) => updateField('leaveStart', event.target.value)}
              />
            </FormField>

            <FormField
              id="leaveEnd"
              label="Leave End"
              required
              error={errors.leaveEnd}
              hint="Use YYYY-MM-DD."
            >
              <DateInput
                value={values.leaveEnd}
                onChange={(event) => updateField('leaveEnd', event.target.value)}
              />
            </FormField>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LinkButton to={cancelTo} state={cancelState} variant="secondary">
          Cancel
        </LinkButton>
        <Button type="submit" loading={submitting}>
          {mode === 'create' ? 'Create employee' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
