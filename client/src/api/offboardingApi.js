import api from './axios';
export const getOffboardingList = (params) => api.get('/offboarding', { params });
export const getOffboarding = (id) => api.get(`/offboarding/${id}`);
export const initiateOffboarding = (data) => api.post('/offboarding', data);
export const toggleChecklistItem = (itemId, data) => api.put(`/offboarding/checklist/${itemId}`, data);
export const completeStep = (stepId) => api.put(`/offboarding/steps/${stepId}/complete`);

// The return-and-revoke checklist: everything the employee still holds across
// equipment, digital access, social access and domains.
export const getClearance = (id, params) => api.get(`/offboarding/${id}/clearance`, { params });

// ── Final settlement ──────────────────────────────────────────────────────────
export const getSettlement = (id) => api.get(`/offboarding/${id}/settlement`);
// inputs: carry_forward_days, leave_days_override, unpaid_leave_days (each optional)
export const calculateSettlement = (id, inputs) => api.post(`/offboarding/${id}/settlement/calculate`, inputs);
export const addSettlementLine = (id, line) => api.post(`/offboarding/${id}/settlement/lines`, line);
export const deleteSettlementLine = (id, lineId) => api.delete(`/offboarding/${id}/settlement/lines/${lineId}`);
export const approveSettlement = (id, data = {}) => api.put(`/offboarding/${id}/settlement/approve`, data);
export const reopenSettlement = (id, reason) => api.put(`/offboarding/${id}/settlement/reopen`, { reason });
export const markSettlementPaid = (id, data) => api.put(`/offboarding/${id}/settlement/paid`, data);
