import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Success: unwrap the { success, data } envelope so consumers see just `data`.
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    return body && body.success === true ? body.data : body;
  },
  (error) => {
    const body = error.response?.data;
    const message = body?.error?.message || error.message || 'Request failed';
    const normalized = new Error(message);
    normalized.code = body?.error?.code || 'REQUEST_ERROR';
    normalized.details = body?.error?.details;
    normalized.status = error.response?.status;
    return Promise.reject(normalized);
  },
);
