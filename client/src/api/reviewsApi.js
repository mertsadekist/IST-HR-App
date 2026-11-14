import api from './axios';

// Appraisals: HR runs cycles; employees, managers and HR each write their part.
export const getCycles = () => api.get('/reviews/cycles');
export const createCycle = (data) => api.post('/reviews/cycles', data);
export const updateCycle = (id, data) => api.put(`/reviews/cycles/${id}`, data);
export const launchCycle = (id) => api.post(`/reviews/cycles/${id}/launch`);
export const closeCycle = (id) => api.post(`/reviews/cycles/${id}/close`);
export const deleteCycle = (id) => api.delete(`/reviews/cycles/${id}`);
export const getCycleReviews = (id) => api.get(`/reviews/cycles/${id}/reviews`);
export const getMine = () => api.get('/reviews/mine');
export const getReview = (id) => api.get(`/reviews/${id}`);
export const saveReview = (id, data) => api.put(`/reviews/${id}`, data);
export const submitReview = (id) => api.post(`/reviews/${id}/submit`);
export const returnReview = (id, to, note) => api.post(`/reviews/${id}/return`, { to, note });
