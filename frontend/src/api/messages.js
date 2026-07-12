import { apiClient } from './client.js';

export function fetchMessages({ limit = 50, before } = {}) {
  const params = { limit };
  if (before) params.before = before;
  return apiClient.get('/api/messages', { params });
}
