import api from './axios';

export const getCompanies = (params) => api.get('/companies', { params });
export const getCompany = (id) => api.get(`/companies/${id}`);
export const createCompany = (data) => api.post('/companies', data);
export const updateCompany = (id, data) => api.put(`/companies/${id}`, data);
export const deleteCompany = (id) => api.delete(`/companies/${id}`);

// Letterhead
export const uploadLetterhead = (id, formData) =>
  api.post(`/companies/${id}/letterhead`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getLetterheadBytes = (id) =>
  api.get(`/companies/${id}/letterhead`, { responseType: 'arraybuffer' });
export const saveLetterheadMargins = (id, margins) =>
  api.put(`/companies/${id}/letterhead-margins`, margins);
export const deleteLetterhead = (id) => api.delete(`/companies/${id}/letterhead`);
