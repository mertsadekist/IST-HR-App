import api from './axios';
export const getTemplates = () => api.get('/legal/templates');
export const createTemplate = (data) => api.post('/legal/templates', data);
export const updateTemplate = (id, data) => api.put(`/legal/templates/${id}`, data);
export const deleteTemplate = (id) => api.delete(`/legal/templates/${id}`);
export const getLetters = (params) => api.get('/legal/letters', { params });
export const generateLetter = (data) => api.post('/legal/letters', data);
export const getLetter = (id) => api.get(`/legal/letters/${id}`);
export const deleteLetter = (id) => api.delete(`/legal/letters/${id}`);
