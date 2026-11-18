import api from './axios';

// Clocking in from the portal: off unless an admin switches it on.
export const getStatus = () => api.get('/clock/status');
export const punch = (data) => api.post('/clock/punch', data);
export const getSettings = () => api.get('/clock/settings');
export const saveSettings = (data) => api.put('/clock/settings', data);
export const getPunches = (date) => api.get('/clock/punches', { params: { date } });
