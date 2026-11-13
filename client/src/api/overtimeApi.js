import api from './axios';

// Overtime: detected from attendance or entered by HR, approved, then paid by payroll.
export const getOvertime = (params) => api.get('/overtime', { params });
export const detectOvertime = (period, params) => api.post('/overtime/detect', { period }, { params });
export const addOvertime = (data) => api.post('/overtime', data);
// minutes may be lowered on approval: { normal_minutes, night_minutes, rest_minutes, note }
export const approveOvertime = (id, data = {}) => api.put(`/overtime/${id}/approve`, data);
export const rejectOvertime = (id, note) => api.put(`/overtime/${id}/reject`, { note });
export const deleteOvertime = (id) => api.delete(`/overtime/${id}`);
