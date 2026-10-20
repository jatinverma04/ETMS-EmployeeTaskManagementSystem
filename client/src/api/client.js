import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: configuredBaseUrl.replace(/\/$/, ''),
  headers: { 'Content-Type': 'application/json' },
});

export function isCanceled(error) {
  return axios.isCancel(error) || error?.code === 'ERR_CANCELED';
}

export function getApiError(error) {
  if (isCanceled(error)) {
    return { message: 'Request canceled.', errors: {}, status: 0, canceled: true };
  }

  const response = error?.response;
  const data = response?.data;
  const fieldErrors = {};

  if (Array.isArray(data?.errors)) {
    for (const entry of data.errors) {
      if (entry?.field && entry?.message) {
        fieldErrors[entry.field] = entry.message;
      }
    }
  }

  let message = data?.message;

  if (!message && error?.code === 'ERR_NETWORK') {
    message = 'Unable to reach the server. Check that the API is running.';
  }

  if (!message) {
    message = 'Something went wrong. Please try again.';
  }

  return {
    message,
    errors: fieldErrors,
    status: response?.status || 0,
    canceled: false,
  };
}

export async function readBlobError(error) {
  const data = error?.response?.data;

  if (!data || typeof data.text !== 'function') {
    return error;
  }

  try {
    const text = await data.text();
    error.response.data = JSON.parse(text);
  } catch {
    error.response.data = null;
  }

  return error;
}
