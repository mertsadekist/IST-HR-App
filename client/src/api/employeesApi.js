import api from './axios';
export const getEmployees = (params) => api.get('/employees', { params });
export const getEmployee = (id) => api.get(`/employees/${id}`);
export const createEmployee = (data) => api.post('/employees', data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data);
export const deleteEmployee = (id) => api.delete(`/employees/${id}`);
export const getEmployeeDocuments = (id) => api.get(`/employees/${id}/documents`);
export const uploadEmployeeDocument = (id, formData) => api.post(`/employees/${id}/documents`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const downloadEmployeeDocument = (id, docId) => api.get(`/employees/${id}/documents/${docId}/download`, {
  responseType: 'blob'
});
