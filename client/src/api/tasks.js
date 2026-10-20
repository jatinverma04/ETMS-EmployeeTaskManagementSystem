import { apiClient, readBlobError } from './client';

export async function listTasks(params = {}, { signal } = {}) {
  const response = await apiClient.get('/tasks', { params, signal });
  return response.data;
}

export async function getTask(taskId, { signal } = {}) {
  const response = await apiClient.get(`/tasks/${taskId}`, { signal });
  return response.data.data;
}

export async function createTask(payload) {
  const response = await apiClient.post('/tasks', payload);
  return response.data.data;
}

export async function updateTask(taskId, payload) {
  const response = await apiClient.put(`/tasks/${taskId}`, payload);
  return response.data.data;
}

export async function updateTaskStatus(taskId, status) {
  const response = await apiClient.put(`/tasks/${taskId}/status`, { status });
  return response.data.data;
}

export async function deleteTask(taskId) {
  await apiClient.delete(`/tasks/${taskId}`);
}

function fallbackFilename() {
  return `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
}

function filenameFromDisposition(disposition) {
  const match = /filename="([^"]+)"/.exec(disposition || '');
  return match?.[1] || fallbackFilename();
}

export async function downloadTasksCsv(params = {}) {
  try {
    const response = await apiClient.get('/tasks/export', {
      params,
      responseType: 'blob',
    });

    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filenameFromDisposition(
      response.headers['content-disposition'],
    );
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    throw await readBlobError(error);
  }
}
