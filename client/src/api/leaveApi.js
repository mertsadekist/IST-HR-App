import api from './axios';

export const getTypes = () => api.get('/leave/types');
export const createType = (data) => api.post('/leave/types', data);
export const getBalances = (params) => api.get('/leave/balances', { params });
export const setBalance = (data) => api.post('/leave/balances', data);
export const getRequests = (params) => api.get('/leave/requests', { params });
export const getReport = (params) => api.get('/leave/report', { params });
export const createRequest = (data) => api.post('/leave/requests', data);
export const approveRequest = (id, data) => api.put(`/leave/requests/${id}/approve`, data || {});
export const rejectRequest = (id, data) => api.put(`/leave/requests/${id}/reject`, data || {});
export const cancelRequest = (id) => api.put(`/leave/requests/${id}/cancel`);
export const getRequestFiles = (id) => api.get(`/leave/requests/${id}/files`);
export const uploadRequestFile = (id, formData) => api.post(`/leave/requests/${id}/files`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const downloadLeaveFile = (fileId) => api.get(`/leave/files/${fileId}/download`, { responseType: 'blob' });

// Balances beyond the entitlement: the ledger (opening, adjustment, carry-forward, lapse, encashment).
export const getBalanceSummary = (params) => api.get('/leave/balances/summary', { params });
export const getAdjustments = (params) => api.get('/leave/adjustments', { params });
export const addAdjustment = (data) => api.post('/leave/adjustments', data);
export const deleteAdjustment = (id) => api.delete(`/leave/adjustments/${id}`);
export const importOpening = (data) => api.post('/leave/adjustments/import', data); // { csv, year, dry_run }
export const carryForward = (data) => api.post('/leave/carry-forward', data);       // { from_year, dry_run }
export const lapseCarried = (data) => api.post('/leave/lapse', data);               // { year, dry_run }
export const encash = (data) => api.post('/leave/encash', data);
export const updateTypePolicy = (id, data) => api.put(`/leave/types/${id}/policy`, data);
// What a request would cost, before it is sent; and what the approver should know.
export const preview = (data) => api.post('/leave/preview', data);
export const getContext = (id) => api.get(`/leave/requests/${id}/context`);
export const getCalendar = (month) => api.get('/leave/calendar', { params: { month } });
export const downloadIcs = (id) => api.get(`/leave/requests/${id}/ics`, { responseType: 'blob' });
