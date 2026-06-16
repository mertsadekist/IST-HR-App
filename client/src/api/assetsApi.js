import api from './axios';
export const getAssets = (params) => api.get('/assets', { params });
export const createAsset = (data) => api.post('/assets', data);
export const updateAsset = (id, data) => api.put(`/assets/${id}`, data);
export const returnAsset = (id, data) => api.put(`/assets/${id}/return`, data);
export const deleteAsset = (id) => api.delete(`/assets/${id}`);
export const uploadReceipt = (id, formData) => api.post(`/assets/${id}/upload-receipt`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const revealPassword = (id) => api.get(`/assets/${id}/reveal-password`);
export const getByEmployee = (employeeId) => api.get(`/assets/by-employee/${employeeId}`);
