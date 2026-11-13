import api from './axios';

// Approval chains: the steps before HR's final decision on leave and overtime.
export const getChains = () => api.get('/approvals/chains');
// company_id 0 = all companies; an empty steps list removes the chain.
export const saveChain = (data) => api.put('/approvals/chains', data);
export const getApprovers = () => api.get('/approvals/approvers');
// What is waiting for the signed-in user, and their decision on it.
export const getMyApprovals = () => api.get('/approvals/mine');
export const actOnApproval = (id, decision, note) => api.post(`/approvals/${id}/act`, { decision, note });
