import api from './axios';
export const getTargets = (params) => api.get('/performance', { params });
export const createTarget = (data) => api.post('/performance', data);
export const updateTarget = (id, data) => api.put(`/performance/${id}`, data);
export const signTarget = (id) => api.put(`/performance/${id}/sign`);
export const deleteTarget = (id) => api.delete(`/performance/${id}`);
