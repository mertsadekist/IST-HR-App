import api from './axios';

export const getJobTitles = (params) => api.get('/job-titles', { params });
export const createJobTitle = (data) => api.post('/job-titles', data);
export const updateJobTitle = (id, data) => api.put(`/job-titles/${id}`, data);
export const deleteJobTitle = (id) => api.delete(`/job-titles/${id}`);
export const addSeniority = (jobTitleId, data) => api.post(`/job-titles/${jobTitleId}/seniorities`, data);
export const deleteSeniority = (id) => api.delete(`/job-titles/seniorities/${id}`);
