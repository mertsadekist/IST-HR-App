import api from './axios';
export const getProfiles = (params) => api.get('/cv-scorer/profiles', { params });
export const createProfile = (data) => api.post('/cv-scorer/profiles', data);
export const deleteProfile = (id) => api.delete(`/cv-scorer/profiles/${id}`);
export const scoreCandidates = (data) => api.post('/cv-scorer/score', data);
export const generateQuestions = (data) => api.post('/cv-scorer/generate-questions', data);
export const generateJD = (data) => api.post('/cv-scorer/generate-jd', data);
