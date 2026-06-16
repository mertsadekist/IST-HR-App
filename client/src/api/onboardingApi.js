import api from './axios';
export const getOnboardingList = (params) => api.get('/onboarding', { params });
export const getOnboarding = (id) => api.get(`/onboarding/${id}`);
export const initOnboarding = (id) => api.post(`/onboarding/${id}/init`);
export const toggleChecklistItem = (itemId, data) => api.put(`/onboarding/checklist/${itemId}`, data);
export const completeStep = (stepId) => api.put(`/onboarding/steps/${stepId}/complete`);
