import api from './axios';

export const list = (params) => api.get('/notifications', { params });
export const unreadCount = () => api.get('/notifications/unread-count');
export const markRead = (id) => api.put(`/notifications/${id}/read`);
export const markAllRead = () => api.put('/notifications/read-all');
export const remove = (id) => api.delete(`/notifications/${id}`);
