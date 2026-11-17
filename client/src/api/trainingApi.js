import api from './axios';

// Training: course catalogue, each person's trainings and certificates, skills.
export const getCourses = (params) => api.get('/training/courses', { params });
export const createCourse = (data) => api.post('/training/courses', data);
export const updateCourse = (id, data) => api.put(`/training/courses/${id}`, data);
export const deleteCourse = (id) => api.delete(`/training/courses/${id}`);
export const getEmployeeTraining = (employeeId) => api.get(`/training/employees/${employeeId}`);
// multipart: course_id, completed_on, expires_on?, result?, notes?, file?
export const addTraining = (employeeId, formData) => api.post(`/training/employees/${employeeId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteTraining = (id) => api.delete(`/training/records/${id}`);
export const downloadCertificate = (id) => api.get(`/training/records/${id}/certificate`, { responseType: 'blob' });
export const saveSkills = (employeeId, skills) => api.put(`/training/employees/${employeeId}/skills`, { skills });
export const getOverview = () => api.get('/training/overview');
