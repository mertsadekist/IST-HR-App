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
export const getEmployeeHistory = (id) => api.get(`/employees/${id}/history`);

// Bank details + the bank-stamped IBAN letter
export const getEmployeeBank = (id) => api.get(`/employees/${id}/bank`);
export const saveEmployeeBank = (id, data) => api.put(`/employees/${id}/bank`, data);
export const verifyEmployeeBank = (id) => api.post(`/employees/${id}/bank/verify`);
export const uploadEmployeeBankFile = (id, formData) => api.post(`/employees/${id}/bank/files`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const downloadEmployeeBankFile = (id, fileId) => api.get(`/employees/${id}/bank/files/${fileId}/download`, { responseType: 'blob' });
export const deleteEmployeeBankFile = (id, fileId) => api.delete(`/employees/${id}/bank/files/${fileId}`);
export const getEmployeeDocuments = (id) => api.get(`/employees/${id}/documents`);
export const uploadEmployeeDocument = (id, formData) => api.post(`/employees/${id}/documents`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
// Removing a document deletes the file from disk too, so a wrong upload can be
// replaced rather than left attached forever.
export const deleteEmployeeDocument = (id, docId) => api.delete(`/employees/${id}/documents/${docId}`);
export const downloadEmployeeDocument = (id, docId) => api.get(`/employees/${id}/documents/${docId}/download`, {
  responseType: 'blob'
});

// Everything one employee holds across the four asset modules.
export const getEmployeeHoldings = (id, params) => api.get(`/employees/${id}/holdings`, { params });
