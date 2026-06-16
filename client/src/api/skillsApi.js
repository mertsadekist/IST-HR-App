import api from './axios';

export const getSkills = () => api.get('/skills');
export const getSkillsFlat = () => api.get('/skills/flat');
export const createCategory = (data) => api.post('/skills/categories', data);
export const updateCategory = (id, data) => api.put(`/skills/categories/${id}`, data);
export const deleteCategory = (id) => api.delete(`/skills/categories/${id}`);
export const createSkill = (data) => api.post('/skills', data);
export const deleteSkill = (id) => api.delete(`/skills/${id}`);
export const importSkills = (data) => api.post('/skills/import', data);
