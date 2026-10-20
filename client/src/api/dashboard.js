import { apiClient } from './client';

export async function getDashboard({ signal } = {}) {
  const response = await apiClient.get('/dashboard', { signal });
  return response.data.data;
}
