import api from './axios';
export const getOffboardingList = (params) => api.get('/offboarding', { params });
export const getOffboarding = (id) => api.get(`/offboarding/${id}`);
export const initiateOffboarding = (data) => api.post('/offboarding', data);
export const toggleChecklistItem = (itemId, data) => api.put(`/offboarding/checklist/${itemId}`, data);
export const completeStep = (stepId) => api.put(`/offboarding/steps/${stepId}/complete`);
