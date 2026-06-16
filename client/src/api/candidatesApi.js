import api from './axios';

export const getCandidates = (params) => api.get('/candidates', { params });
export const getCandidate = (id) => api.get(`/candidates/${id}`);
export const createCandidate = (data) => api.post('/candidates', data);
export const updateCandidate = (id, data) => api.put(`/candidates/${id}`, data);
export const moveCandidate = (id, data) => api.put(`/candidates/${id}/move`, data);
export const deleteCandidate = (id) => api.delete(`/candidates/${id}`);
export const uploadCV = (id, formData) => api.post(`/candidates/${id}/upload-cv`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getWatiTags = (id) => api.get(`/candidates/${id}/wati-tags`);
export const parseCV = (formData) => api.post('/candidates/parse-cv', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const parseCandidateCV = (id) => api.post(`/candidates/${id}/parse`);
