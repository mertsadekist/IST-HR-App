import api from './axios';

export const getTypes = () => api.get('/leave/types');
export const createType = (data) => api.post('/leave/types', data);
export const getBalances = (params) => api.get('/leave/balances', { params });
export const setBalance = (data) => api.post('/leave/balances', data);
export const getRequests = (params) => api.get('/leave/requests', { params });
export const getReport = (params) => api.get('/leave/report', { params });
export const createRequest = (data) => api.post('/leave/requests', data);
export const approveRequest = (id, data) => api.put(`/leave/requests/${id}/approve`, data || {});
export const rejectRequest = (id, data) => api.put(`/leave/requests/${id}/reject`, data || {});
export const cancelRequest = (id) => api.put(`/leave/requests/${id}/cancel`);
export const getRequestFiles = (id) => api.get(`/leave/requests/${id}/files`);
export const uploadRequestFile = (id, formData) => api.post(`/leave/requests/${id}/files`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const downloadLeaveFile = (fileId) => api.get(`/leave/files/${fileId}/download`, { responseType: 'blob' });
