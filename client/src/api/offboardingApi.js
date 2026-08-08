import api from './axios';
export const getOffboardingList = (params) => api.get('/offboarding', { params });
export const getOffboarding = (id) => api.get(`/offboarding/${id}`);
export const initiateOffboarding = (data) => api.post('/offboarding', data);
export const toggleChecklistItem = (itemId, data) => api.put(`/offboarding/checklist/${itemId}`, data);
export const completeStep = (stepId) => api.put(`/offboarding/steps/${stepId}/complete`);

// The return-and-revoke checklist: everything the employee still holds across
// equipment, digital access, social access and domains.
export const getClearance = (id, params) => api.get(`/offboarding/${id}/clearance`, { params });
