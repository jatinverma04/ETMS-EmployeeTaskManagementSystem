import { useLocation, useNavigate } from 'react-router-dom';
import { createEmployee } from '../api/employees';
import Breadcrumbs from '../components/common/Breadcrumbs';
import PageHeader from '../components/common/PageHeader';
import { useToast } from '../components/common/ToastProvider';
import EmployeeForm, {
  emptyEmployeeValues,
} from '../components/employees/EmployeeForm';

export default function EmployeeCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const backTo = location.state?.from || '/employees';

  async function handleSubmit(payload) {
    const employee = await createEmployee(payload);
    toast.success(`${employee.fullName} was added.`);
    navigate(`/employees/${employee.id}`, { state: { from: backTo } });
  }

  return (
    <>
      <PageHeader
        title="Add employee"
        description="Create an employee record with contact, employment, and leave details."
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Employees', to: backTo },
              { label: 'Add employee' },
            ]}
          />
        }
      />

      <EmployeeForm
        mode="create"
        initialValues={emptyEmployeeValues}
        onSubmit={handleSubmit}
        cancelTo={backTo}
      />
    </>
  );
}
