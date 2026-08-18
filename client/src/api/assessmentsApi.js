import api from './axios';

// Templates
export const listTemplates = (params) => api.get('/assessments/templates', { params });
export const getTemplate = (id, params) => api.get(`/assessments/templates/${id}`, { params });
export const createTemplate = (data) => api.post('/assessments/templates', data);
export const updateTemplate = (id, data) => api.put(`/assessments/templates/${id}`, data);
export const deleteTemplate = (id) => api.delete(`/assessments/templates/${id}`);
export const publishVersion = (id, data) => api.post(`/assessments/templates/${id}/versions`, data);

// Stages
export const updateStage = (stageId, data) => api.put(`/assessments/stages/${stageId}`, data);

// Questions
export const createQuestion = (stageId, data) => api.post(`/assessments/stages/${stageId}/questions`, data);
export const updateQuestion = (id, data) => api.put(`/assessments/questions/${id}`, data);
export const deleteQuestion = (id) => api.delete(`/assessments/questions/${id}`);

// Sessions (used from the Applicant Detail view)
export const createSession = (applicationId) => api.post(`/assessments/applications/${applicationId}/sessions`);
export const listSessions = (applicationId) => api.get(`/assessments/applications/${applicationId}/sessions`);
export const getSession = (id) => api.get(`/assessments/sessions/${id}`);
export const getSessionReport = (id) => api.get(`/assessments/sessions/${id}/report`);
export const pauseSession = (id) => api.put(`/assessments/sessions/${id}/pause`);
export const resumeSession = (id) => api.put(`/assessments/sessions/${id}/resume`);
export const stopSession = (id, reason) => api.put(`/assessments/sessions/${id}/stop`, { reason });
export const advanceSession = (id) => api.post(`/assessments/sessions/${id}/advance`);
export const reevaluateAnswer = (id) => api.post(`/assessments/answers/${id}/reevaluate`);
export const overrideAnswer = (id, data) => api.put(`/assessments/answers/${id}/override`, data);
