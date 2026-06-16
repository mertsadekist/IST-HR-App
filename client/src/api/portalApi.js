import api from './axios';

export const getMyAssets = () => api.get('/portal/my-assets');
export const revealMyPassword = (id) => api.get(`/portal/my-assets/${id}/reveal`);
export const getMyInventory = () => api.get('/portal/my-inventory');
