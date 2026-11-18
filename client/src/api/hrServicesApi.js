import api from './axios';

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

// Announcements
export const getAnnouncements = () => api.get('/hr-services/announcements');
export const getUnreadAnnouncements = () => api.get('/hr-services/announcements/unread-count');
export const createAnnouncement = (data) => api.post('/hr-services/announcements', data);
export const updateAnnouncement = (id, data) => api.put(`/hr-services/announcements/${id}`, data);
export const markAnnouncementRead = (id) => api.post(`/hr-services/announcements/${id}/read`);
export const deleteAnnouncement = (id) => api.delete(`/hr-services/announcements/${id}`);

// Policies
export const getPolicies = () => api.get('/hr-services/policies');
export const getPolicy = (id) => api.get(`/hr-services/policies/${id}`);
export const downloadPolicy = (id) => api.get(`/hr-services/policies/${id}/file`, { responseType: 'blob' });
export const createPolicy = (formData) => api.post('/hr-services/policies', formData, multipart);
export const updatePolicy = (id, formData) => api.put(`/hr-services/policies/${id}`, formData, multipart);
export const publishPolicy = (id) => api.post(`/hr-services/policies/${id}/publish`);
export const retirePolicy = (id) => api.post(`/hr-services/policies/${id}/retire`);
export const acknowledgePolicy = (id) => api.post(`/hr-services/policies/${id}/acknowledge`);
export const getPolicyAcks = (id) => api.get(`/hr-services/policies/${id}/acknowledgements`);
export const remindPolicy = (id) => api.post(`/hr-services/policies/${id}/remind`);

// Disciplinary file
export const getCases = (params) => api.get('/hr-services/disciplinary', { params });
export const createCase = (data) => api.post('/hr-services/disciplinary', data);
export const updateCase = (id, data) => api.put(`/hr-services/disciplinary/${id}`, data);
export const deleteCase = (id) => api.delete(`/hr-services/disciplinary/${id}`);
export const getCaseLetters = () => api.get('/hr-services/disciplinary/letters');
