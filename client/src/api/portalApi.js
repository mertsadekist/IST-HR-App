import api from './axios';

export const getMyAssets = () => api.get('/portal/my-assets');
export const revealMyPassword = (id) => api.get(`/portal/my-assets/${id}/reveal`);
export const getMyInventory = () => api.get('/portal/my-inventory');

// For anyone who manages people: whether they have a team, and the team itself
// (attendance and leave only, never pay or documents).
export const hasTeam = () => api.get('/portal/has-team');
export const getMyTeam = () => api.get('/portal/my-team');
