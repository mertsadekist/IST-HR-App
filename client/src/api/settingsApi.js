import api from './axios';

export const getAssetCategories = () => api.get('/settings/asset-categories');
export const createAssetCategory = (data) => api.post('/settings/asset-categories', data);
export const updateAssetCategory = (id, data) => api.put(`/settings/asset-categories/${id}`, data);
export const deleteAssetCategory = (id) => api.delete(`/settings/asset-categories/${id}`);

export const getPlatformCatalog = (params) => api.get('/settings/platform-catalog', { params });
export const createPlatformItem = (data) => api.post('/settings/platform-catalog', data);
export const updatePlatformItem = (id, data) => api.put(`/settings/platform-catalog/${id}`, data);
export const deletePlatformItem = (id) => api.delete(`/settings/platform-catalog/${id}`);

export const getAtsStages = () => api.get('/settings/ats-stages');
export const createAtsStage = (data) => api.post('/settings/ats-stages', data);
export const updateAtsStage = (id, data) => api.put(`/settings/ats-stages/${id}`, data);
export const deleteAtsStage = (id) => api.delete(`/settings/ats-stages/${id}`);
export const reorderAtsStages = (data) => api.put('/settings/ats-stages/reorder', data);

export const getOnboardingTemplates = (params) => api.get('/settings/onboarding-templates', { params });
export const createOnboardingTemplate = (data) => api.post('/settings/onboarding-templates', data);
export const updateOnboardingTemplate = (id, data) => api.put(`/settings/onboarding-templates/${id}`, data);
export const deleteOnboardingTemplate = (id) => api.delete(`/settings/onboarding-templates/${id}`);

export const getOffboardingTemplates = (params) => api.get('/settings/offboarding-templates', { params });
export const createOffboardingTemplate = (data) => api.post('/settings/offboarding-templates', data);
export const updateOffboardingTemplate = (id, data) => api.put(`/settings/offboarding-templates/${id}`, data);
export const deleteOffboardingTemplate = (id) => api.delete(`/settings/offboarding-templates/${id}`);
