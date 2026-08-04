import api from './axios';

export const getInventory = (params) => api.get('/inventory', { params });
export const getInventoryItem = (id) => api.get(`/inventory/${id}`);
export const createInventoryItem = (data) => api.post('/inventory', data);
export const updateInventoryItem = (id, data) => api.put(`/inventory/${id}`, data);
export const deleteInventoryItem = (id) => api.delete(`/inventory/${id}`);
export const getItemHistory = (id) => api.get(`/inventory/${id}/history`);
export const getItemBarcode = (id) => api.get(`/inventory/${id}/barcode`);
export const getItemQRCode = (id) => api.get(`/inventory/${id}/qrcode`);
export const getItemLabel = (id) => api.get(`/inventory/${id}/label`);
export const getBulkLabels = (ids) => api.post('/inventory/bulk-labels', { ids });
export const getInventoryStats = (params) => api.get('/inventory/stats/summary', { params });
// Verify a returned unit. Passing releases it into available stock; failing must
// say where it goes and why (assets PRD business rule 1).
export const inspectItem = (id, data, params) => api.post(`/inventory/${id}/inspect`, data, { params });
// The PRD availability line per platform, derived from the real per-unit rows.
export const getAvailability = (params) => api.get('/inventory/availability', { params });
export const uploadItemImage = (id, formData) => api.post(`/inventory/${id}/upload-image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
