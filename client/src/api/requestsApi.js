import api from './axios';

// Portal requests: letters, expenses, salary advances and HR cases.
// Employees see their own; admin, HR manager and accountant see the queue.
export const getRequests = (params) => api.get('/requests', { params });
export const getRequest = (id) => api.get(`/requests/${id}`);
// multipart: type + the type's fields, optional `file`
export const createRequest = (formData) => api.post('/requests', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const addFile = (id, file, kind = 'attachment') => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', kind);
  return api.post(`/requests/${id}/files`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const downloadFile = (fileId) => api.get(`/requests/files/${fileId}/download`, { responseType: 'blob' });
export const addComment = (id, body) => api.post(`/requests/${id}/comments`, { body });
export const cancelRequest = (id) => api.put(`/requests/${id}/cancel`);
export const rejectRequest = (id, reason) => api.put(`/requests/${id}/reject`, { reason });
// expense: { period }, advance: { start_period, instalment }, letter: {} (the issued letter uploaded first)
export const approveRequest = (id, data = {}) => api.put(`/requests/${id}/approve`, data);
// working a case or a letter: { status, assigned_to, due_date }
export const updateCase = (id, data) => api.put(`/requests/${id}/case`, data);
export const getAssignees = () => api.get('/requests/meta/assignees');
