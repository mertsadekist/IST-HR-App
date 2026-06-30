import api from './axios';

export const list = (params) => api.get('/attendance', { params });
export const record = (data) => api.post('/attendance', data);
export const checkIn = () => api.post('/attendance/check-in');
export const checkOut = () => api.post('/attendance/check-out');
export const summary = (params) => api.get('/attendance/summary', { params });
export const update = (id, data) => api.put(`/attendance/${id}`, data);
export const remove = (id) => api.delete(`/attendance/${id}`);
export const importFile = (form) => api.post('/attendance/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
export const exportFile = (params) => api.get('/attendance/export', { params, responseType: 'blob' });
