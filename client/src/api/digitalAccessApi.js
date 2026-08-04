import api from './axios';

export const getDigitalAccess = (params) => api.get('/digital-access', { params });
export const getAccessOptions = () => api.get('/digital-access/options');
export const getAccessReports = (params) => api.get('/digital-access/reports', { params });
export const getAccessByEmployee = (employeeId, params) => api.get(`/digital-access/by-employee/${employeeId}`, { params });
export const createAccess = (data) => api.post('/digital-access', data);
export const updateAccess = (id, data, params) => api.put(`/digital-access/${id}`, data, { params });
// Revoking releases the paid seat back into the platform's stock, once.
export const revokeAccess = (id, data, params) => api.put(`/digital-access/${id}/revoke`, data, { params });
export const reviewAccess = (id, params) => api.put(`/digital-access/${id}/review`, {}, { params });
export const deleteAccess = (id, params) => api.delete(`/digital-access/${id}`, { params });
