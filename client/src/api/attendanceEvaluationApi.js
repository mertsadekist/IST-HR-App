import api from './axios';

export const runEvaluation = (data) => api.post('/attendance-evaluation/run', data);
export const getRuns = () => api.get('/attendance-evaluation/runs');
export const getSummary = (params) => api.get('/attendance-evaluation/summary', { params });
export const getExceptions = (params) => api.get('/attendance-evaluation/exceptions', { params });
export const getComparison = (params) => api.get('/attendance-evaluation/comparison', { params });
