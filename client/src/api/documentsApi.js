import api from './axios';
export const getCategories = () => api.get('/documents/categories');
export const createCategory = (data) => api.post('/documents/categories', data);
export const deleteCategory = (id) => api.delete(`/documents/categories/${id}`);
export const getDocuments = (params) => api.get('/documents', { params });
export const uploadDocument = (formData) => api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const downloadDocument = (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' });
export const deleteDocument = (id) => api.delete(`/documents/${id}`);
