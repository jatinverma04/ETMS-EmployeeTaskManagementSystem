import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getEmployee, updateEmployee } from '../api/employees';
import Breadcrumbs from '../components/common/Breadcrumbs';
import ErrorState from '../components/common/ErrorState';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import PageHeader from '../components/common/PageHeader';
import { useToast } from '../components/common/ToastProvider';
import EmployeeForm, {
  employeeToFormValues,
} from '../components/employees/EmployeeForm';
import { useApiResource } from '../hooks/useApiResource';

export default function EmployeeEditPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: employee, loading, error, reload } = useApiResource(
    ({ signal }) => getEmployee(id, { signal }),
    [id],
  );
  const backTo = location.state?.from || '/employees';
  const viewTo = `/employees/${id}`;
  const viewState = { from: backTo };

  async function handleSubmit(payload) {
    const updated = await updateEmployee(id, payload);
    toast.success(`${updated.fullName} was updated.`);
    navigate(viewTo, { state: viewState });
  }

  return (
    <>
      <PageHeader
        title={employee ? `Edit ${employee.fullName}` : 'Edit employee'}
        description="Update employee information. Changes are validated against the employee rules."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Employees', to: backTo },
              { label: employee?.fullName || 'Employee', to: viewTo, state: viewState },
              { label: 'Edit' },
            ]}
          />
        }
      />

      {loading ? <LoadingSkeleton rows={7} /> : null}

      {!loading && error ? (
        <ErrorState
          title={error.status === 404 ? 'Employee not found' : 'Unable to load employee'}
          message={error.message}
          onRetry={reload}
        />
      ) : null}

      {!loading && employee ? (
        <EmployeeForm
          key={employee.id}
          mode="edit"
          initialValues={employeeToFormValues(employee)}
          onSubmit={handleSubmit}
          cancelTo={viewTo}
          cancelState={viewState}
        />
      ) : null}
    </>
  );
}
