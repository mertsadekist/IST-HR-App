import api from './axios';

export const getSocialOptions = () => api.get('/social/options');
export const getGovernance = (params) => api.get('/social/governance', { params });

export const getSocialAccounts = (params) => api.get('/social/accounts', { params });
export const getSocialAccount = (id, params) => api.get(`/social/accounts/${id}`, { params });
export const createSocialAccount = (data) => api.post('/social/accounts', data);
export const updateSocialAccount = (id, data, params) => api.put(`/social/accounts/${id}`, data, { params });
export const reviewSocialAccount = (id, params) => api.put(`/social/accounts/${id}/review`, {}, { params });
export const deleteSocialAccount = (id, params) => api.delete(`/social/accounts/${id}`, { params });

export const getSocialAccess = (params) => api.get('/social/access', { params });
export const createSocialAccess = (data) => api.post('/social/access', data);
export const updateSocialAccess = (id, data, params) => api.put(`/social/access/${id}`, data, { params });
export const removeSocialAccess = (id, data, params) => api.put(`/social/access/${id}/remove`, data, { params });
export const reviewSocialAccess = (id, params) => api.put(`/social/access/${id}/review`, {}, { params });
// Offboarding: close every layer for one person in a single call — doing it row
// by row is how a layer gets missed.
export const removePersonEverywhere = (data, params) => api.post('/social/access/remove-person', data, { params });
export const deleteSocialAccess = (id, params) => api.delete(`/social/access/${id}`, { params });
