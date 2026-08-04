import api from './axios';

export const getDomains = (params) => api.get('/domains', { params });
export const getDomainOptions = () => api.get('/domains/options');
// The watch-list: what renews soon, what already lapsed, and what nobody is
// named to pay for.
export const getExpiring = (params) => api.get('/domains/expiring', { params });
export const createDomain = (data) => api.post('/domains', data);
export const updateDomain = (id, data, params) => api.put(`/domains/${id}`, data, { params });
// Record that the renewal was paid: rolls the date forward and clears the alerts.
export const renewDomain = (id, data, params) => api.put(`/domains/${id}/renew`, data, { params });
export const deleteDomain = (id, params) => api.delete(`/domains/${id}`, { params });
export const runRenewalCheck = (params) => api.post('/domains/run-renewal-check', {}, { params });
