import api from './axios';

export const getVacancies = (params) => api.get('/vacancies', { params });
export const getVacancy = (id) => api.get(`/vacancies/${id}`);
export const createVacancy = (data) => api.post('/vacancies', data);
export const updateVacancy = (id, data) => api.put(`/vacancies/${id}`, data);
export const deleteVacancy = (id) => api.delete(`/vacancies/${id}`);
