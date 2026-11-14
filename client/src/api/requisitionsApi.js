import api from './axios';

// Hiring requests: raised by managers or HR, approved, then a Draft vacancy.
export const getRequisitions = (params) => api.get('/requisitions', { params });
export const createRequisition = (data) => api.post('/requisitions', data);
export const approveRequisition = (id, data = {}) => api.put(`/requisitions/${id}/approve`, data);
export const rejectRequisition = (id, reason) => api.put(`/requisitions/${id}/reject`, { reason });
export const cancelRequisition = (id) => api.put(`/requisitions/${id}/cancel`);
