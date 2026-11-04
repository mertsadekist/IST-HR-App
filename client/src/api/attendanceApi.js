import api from './axios';

export const list = (params) => api.get('/attendance', { params });
export const record = (data) => api.post('/attendance', data);
export const checkIn = () => api.post('/attendance/check-in');
export const checkOut = () => api.post('/attendance/check-out');
export const summary = (params) => api.get('/attendance/summary', { params });
export const update = (id, data) => api.put(`/attendance/${id}`, data);
export const remove = (id) => api.delete(`/attendance/${id}`);
export const importFile = (form) => api.post('/attendance/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
export const exportFile = (params) => api.get('/attendance/export', { params, responseType: 'blob' });

// ─── Hik Central sync ────────────────────────────────────────────────────────
export const syncStatus = () => api.get('/attendance/hik-sync/status');
export const syncTest = () => api.get('/attendance/hik-sync/test');
export const syncSchema = () => api.get('/attendance/hik-sync/schema');
export const syncRun = (data) => api.post('/attendance/hik-sync/run', data || {});
export const syncFinalize = (data) => api.post('/attendance/hik-sync/finalize', data || {});
export const syncBackfill = (data) => api.post('/attendance/hik-sync/backfill', data);
export const syncIgnore = (data) => api.post('/attendance/hik-sync/ignore', data);
export const syncUnignore = (deviceId) => api.delete(`/attendance/hik-sync/ignore/${encodeURIComponent(deviceId)}`);
