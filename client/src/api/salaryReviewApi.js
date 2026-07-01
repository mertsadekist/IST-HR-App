import api from './axios';

export const getReviews = (params) => api.get('/salary-reviews', { params });
export const getReview = (id) => api.get(`/salary-reviews/${id}`);
export const createReview = (data) => api.post('/salary-reviews', data);
export const deleteReview = (id) => api.delete(`/salary-reviews/${id}`);
export const submitReview = (id) => api.post(`/salary-reviews/${id}/submit`);
export const decideReview = (id, data) => api.put(`/salary-reviews/${id}/decision`, data);
export const reopenReview = (id) => api.post(`/salary-reviews/${id}/reopen`);

export const updateItem = (itemId, data) => api.put(`/salary-reviews/items/${itemId}`, data);
export const addAction = (itemId, label) => api.post(`/salary-reviews/items/${itemId}/actions`, { label });
export const updateAction = (actionId, data) => api.put(`/salary-reviews/actions/${actionId}`, data);
export const draftLetter = (itemId) => api.post(`/salary-reviews/items/${itemId}/letter`);

export const uploadDocument = (itemId, formData) => api.post(`/salary-reviews/items/${itemId}/documents`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const downloadDocument = (itemId, docId) => api.get(`/salary-reviews/items/${itemId}/documents/${docId}/download`, {
  responseType: 'blob',
});
