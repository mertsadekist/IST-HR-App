import api from './axios';
export const getAssets = (params) => api.get('/assets', { params });
export const createAsset = (data) => api.post('/assets', data);
export const updateAsset = (id, data) => api.put(`/assets/${id}`, data);
export const returnAsset = (id, data) => api.put(`/assets/${id}/return`, data);
export const deleteAsset = (id) => api.delete(`/assets/${id}`);
export const uploadReceipt = (id, formData) => api.post(`/assets/${id}/upload-receipt`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
// POST, not GET: a URL carrying this action lands in access logs, proxy logs and
// browser history. The reason is mandatory and recorded in the audit log, and
// the caller's own password is re-checked — a valid session alone is not enough
// to read a stored credential.
export const revealPassword = (id, reason, password) =>
  api.post(`/assets/${id}/reveal-password`, { reason, password });
export const getByEmployee = (employeeId) => api.get(`/assets/by-employee/${employeeId}`);
