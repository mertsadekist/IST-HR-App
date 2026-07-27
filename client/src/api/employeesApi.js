import api from './axios';
export const getEmployees = (params) => api.get('/employees', { params });
export const getEmployee = (id) => api.get(`/employees/${id}`);
export const createEmployee = (data) => api.post('/employees', data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data);
export const deleteEmployee = (id) => api.delete(`/employees/${id}`);
export const createEmployeeLogin = (id) => api.post(`/employees/${id}/create-login`);
// Photo bytes are fetched as a blob (an <img src> can't carry the Bearer token).
export const uploadEmployeePhoto = (id, formData) => api.post(`/employees/${id}/photo`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getEmployeePhotoBytes = (id) => api.get(`/employees/${id}/photo`, { responseType: 'blob' });
export const deleteEmployeePhoto = (id) => api.delete(`/employees/${id}/photo`);
export const getEmployeeDocuments = (id) => api.get(`/employees/${id}/documents`);
export const uploadEmployeeDocument = (id, formData) => api.post(`/employees/${id}/documents`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const downloadEmployeeDocument = (id, docId) => api.get(`/employees/${id}/documents/${docId}/download`, {
  responseType: 'blob'
});
