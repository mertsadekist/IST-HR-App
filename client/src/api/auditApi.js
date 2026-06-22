import api from './axios';

export const getAuditLogs = (params) => api.get('/audit', { params });
export const getAuditFacets = (params) => api.get('/audit/facets', { params });
export const exportAuditLogs = (params) => api.get('/audit/export', { params, responseType: 'blob' });
