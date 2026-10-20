import { apiClient } from './client';

export async function listEmployees(params = {}, { signal } = {}) {
  const response = await apiClient.get('/employees', { params, signal });
  return response.data;
}

export async function listAllEmployees({ signal } = {}) {
  const employees = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await listEmployees(
      { page, limit: 100, sort: 'fullName', order: 'asc' },
      { signal },
    );

    employees.push(...result.data);
    totalPages = result.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return employees;
}

export async function getEmployee(employeeId, { signal } = {}) {
  const response = await apiClient.get(`/employees/${employeeId}`, { signal });
  return response.data.data;
}

export async function createEmployee(payload) {
  const response = await apiClient.post('/employees', payload);
  return response.data.data;
}

export async function updateEmployee(employeeId, payload) {
  const response = await apiClient.put(`/employees/${employeeId}`, payload);
  return response.data.data;
}

export async function deleteEmployee(employeeId) {
  await apiClient.delete(`/employees/${employeeId}`);
}
