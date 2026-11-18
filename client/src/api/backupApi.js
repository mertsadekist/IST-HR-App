import api from './axios';

// Nightly database backups on the server volume (platform admin only).
export const listNightly = () => api.get('/backup/nightly');
export const runNightly = () => api.post('/backup/nightly/run', {}, { timeout: 300000 });
export const downloadNightly = (name) => api.get(`/backup/nightly/${encodeURIComponent(name)}`, { responseType: 'blob', timeout: 300000 });
