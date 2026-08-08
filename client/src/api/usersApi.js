import api from './axios';

export const getUsers = (params) => api.get('/users', { params });
export const getUser = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const resetPassword = (id, data) => api.put(`/users/${id}/password`, data);
// Admin-only "Login as": returns a short-lived token carrying the target's
// identity plus a claim naming the admin who borrowed it.
export const impersonate = (id) => api.post(`/users/${id}/impersonate`);
