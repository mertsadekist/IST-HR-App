import api from './axios';
export const sendEmail = (data) => api.post('/email/send', data);
export const sendTemplateEmail = (data) => api.post('/email/send-template', data);
export const sendBulkEmail = (data) => api.post('/email/send-bulk', data);
export const previewTemplate = (data) => api.post('/email/preview', data);
export const getTemplates = () => api.get('/email/templates');
export const getEmailLog = (params) => api.get('/email/log', { params });
export const getEmailStats = (params) => api.get('/email/log/stats', { params });
export const getEmailFacets = (params) => api.get('/email/log/facets', { params });
export const exportEmailLog = (params) => api.get('/email/log/export', { params });
export const getEmailDetail = (id) => api.get(`/email/log/${id}`);
export const testSMTP = (data) => api.post('/email/test', data);
export const getEmailConfig = (params) => api.get('/email/config', { params });
export const saveEmailConfig = (data) => api.put('/email/config', data);
export const testEmailConfig = (data) => api.post('/email/config/test', data);
// Email a PDF document with a cover message. `formData` is multipart with a
// `file` (the PDF blob) plus to/toName/title/message/cc/relatedModule/relatedId.
export const sendDocument = (formData) =>
  api.post('/email/send-document', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
