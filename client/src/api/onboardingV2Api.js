import api from './axios';

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

// Records
export const list = (params) => api.get('/onboarding/v2', { params });
export const get = (id) => api.get(`/onboarding/v2/${id}`);
export const create = (data) => api.post('/onboarding/v2', data);
export const advance = (id, data) => api.post(`/onboarding/v2/${id}/advance`, data || {});
export const cancel = (id, data) => api.post(`/onboarding/v2/${id}/cancel`, data);

// CV + profile
export const uploadCV = (id, formData) => api.post(`/onboarding/v2/${id}/cv`, formData, multipart);
export const updateProfile = (id, data) => api.put(`/onboarding/v2/${id}/profile`, data);
export const verifyProfile = (id) => api.post(`/onboarding/v2/${id}/verify-profile`);

// HR review
export const review = (id, data) => api.post(`/onboarding/v2/${id}/review`, data);

// Offers
export const createOffer = (id, data) => api.post(`/onboarding/v2/${id}/offers`, data);
export const updateOffer = (offerId, data) => api.put(`/onboarding/v2/offers/${offerId}`, data);
export const sendOffer = (offerId) => api.post(`/onboarding/v2/offers/${offerId}/send`);
export const respondOffer = (offerId, data) => api.post(`/onboarding/v2/offers/${offerId}/respond`, data);

// Signed offer
export const uploadSignedOffer = (id, formData) => api.post(`/onboarding/v2/${id}/signed-offer`, formData, multipart);
export const verifySignedOffer = (id, data) => api.post(`/onboarding/v2/${id}/signed-offer/verify`, data);

// Documents
export const seedDocuments = (id) => api.post(`/onboarding/v2/${id}/documents/seed`);
export const uploadDocument = (docId, formData) => api.post(`/onboarding/v2/documents/${docId}/upload`, formData, multipart);
export const verifyDocument = (docId, data) => api.post(`/onboarding/v2/documents/${docId}/verify`, data);

// Visa
export const seedVisa = (id) => api.post(`/onboarding/v2/${id}/visa/seed`);
export const updateVisaStep = (stepId, data) => api.put(`/onboarding/v2/visa/${stepId}`, data);

// Bank
export const saveBank = (id, data) => api.put(`/onboarding/v2/${id}/bank`, data);
export const verifyBank = (id) => api.post(`/onboarding/v2/${id}/bank/verify`);

// Comments
export const addComment = (id, data) => api.post(`/onboarding/v2/${id}/comments`, data);
