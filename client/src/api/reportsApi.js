import api from './axios';
export const getPipelineReport = (params) => api.get('/reports/pipeline', { params });
export const getJourneyReport = (params) => api.get('/reports/journey', { params });
export const getEmployeesReport = (params) => api.get('/reports/employees', { params });
export const getOnboardingReport = (params) => api.get('/reports/onboarding', { params });
