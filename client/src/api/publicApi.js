import axios from 'axios';

// Public recruitment API — no auth required. Uses a bare axios instance so we
// never attach a stale token or trigger the 401 redirect for logged-out visitors.
const pub = axios.create({ baseURL: '/api/public', timeout: 120000 });

export const getJob = (slug) => pub.get(`/jobs/${slug}`);
export const applyToJob = (slug, formData) => pub.post(`/jobs/${slug}/apply`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Applicant assessment flow — no auth, token-scoped.
export const getAssessment = (token) => pub.get(`/assessment/${token}`);
export const startAssessment = (token) => pub.post(`/assessment/${token}/start`);
export const saveAssessmentAnswer = (token, questionId, data) => pub.put(`/assessment/${token}/answers/${questionId}`, data);
export const submitAssessmentStage = (token, stageOrder) => pub.post(`/assessment/${token}/stages/${stageOrder}/submit`);
export const getAssessmentResult = (token) => pub.get(`/assessment/${token}/result`);
