import api from './axios';

export const runEvaluation = (data) => api.post('/attendance-evaluation/run', data);
export const getRuns = () => api.get('/attendance-evaluation/runs');
export const getSummary = (params) => api.get('/attendance-evaluation/summary', { params });
export const getExceptions = (params) => api.get('/attendance-evaluation/exceptions', { params });
export const getComparison = (params) => api.get('/attendance-evaluation/comparison', { params });
export const getReport = (params) => api.get('/attendance-evaluation/report', { params });

// Resolving a case: the reasons on offer, recording one, or waiving it outright.
export const getReasons = (params) => api.get('/attendance-evaluation/reasons', { params });
export const recordReason = (id, data) => api.post(`/attendance-evaluation/exceptions/${id}/leave`, data);
export const updateException = (id, data) => api.put(`/attendance-evaluation/exceptions/${id}`, data);
