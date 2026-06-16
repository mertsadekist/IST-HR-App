import api from './axios';

export const getStats = (params) => api.get('/dashboard/stats', { params });
export const getPipeline = (params) => api.get('/dashboard/pipeline', { params });
export const getRecentActivity = (params) => api.get('/dashboard/recent-activity', { params });
export const getHiresByMonth = (params) => api.get('/dashboard/hires-by-month', { params });
