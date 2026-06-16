import api from './axios';
export const summarizeCandidate = (data) => api.post('/ai/summarize', data);
