import api from './axios';
export const getTiers = () => api.get('/kpi/tiers');
export const createTier = (data) => api.post('/kpi/tiers', data);
export const getTargets = () => api.get('/kpi/targets');
export const getHires = (params) => api.get('/kpi/hires', { params });
export const logHire = (data) => api.post('/kpi/hires', data);
export const confirmHire = (id) => api.put(`/kpi/hires/${id}/confirm`);
export const deleteHire = (id) => api.delete(`/kpi/hires/${id}`);
export const getSummary = () => api.get('/kpi/summary');
