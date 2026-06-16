import api from './axios';

export const list = (params) => api.get('/applications', { params });
export const get = (id) => api.get(`/applications/${id}`);
export const moveStage = (id, data) => api.put(`/applications/${id}/stage`, data);
export const rate = (id, data) => api.put(`/applications/${id}/rate`, data);
export const assign = (id, data) => api.put(`/applications/${id}/assign`, data);
export const shortlist = (id) => api.post(`/applications/${id}/shortlist`);
export const reject = (id, data) => api.post(`/applications/${id}/reject`, data);
export const cvUrl = (id) => `/api/applications/${id}/cv`;
export const downloadCV = (id) => api.get(`/applications/${id}/cv`, { responseType: 'blob' });
export const scheduleInterview = (id, data) => api.post(`/applications/${id}/interviews`, data);
export const updateInterview = (id, data) => api.put(`/applications/interviews/${id}`, data);
export const evaluate = (id, data) => api.post(`/applications/${id}/evaluations`, data);
export const convert = (id) => api.post(`/applications/${id}/convert`);
export const sourceStats = () => api.get('/applications/stats/sources');

// Vacancy publishing helpers
export const publishVacancy = (id) => api.post(`/vacancies/${id}/publish`);
export const pauseVacancy = (id) => api.post(`/vacancies/${id}/pause`);
export const closeVacancy = (id) => api.post(`/vacancies/${id}/close`);
export const archiveVacancy = (id) => api.post(`/vacancies/${id}/archive`);
