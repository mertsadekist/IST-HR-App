import api from './axios';

// Reports emailed on a schedule (Settings → Scheduled reports).
export const list = () => api.get('/report-schedules');
export const create = (data) => api.post('/report-schedules', data);
export const update = (id, data) => api.put(`/report-schedules/${id}`, data);
export const remove = (id) => api.delete(`/report-schedules/${id}`);
export const sendNow = (id) => api.post(`/report-schedules/${id}/send-now`);
