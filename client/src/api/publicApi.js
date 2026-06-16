import axios from 'axios';

// Public recruitment API — no auth required. Uses a bare axios instance so we
// never attach a stale token or trigger the 401 redirect for logged-out visitors.
const pub = axios.create({ baseURL: '/api/public', timeout: 120000 });

export const getJob = (slug) => pub.get(`/jobs/${slug}`);
export const applyToJob = (slug, formData) => pub.post(`/jobs/${slug}/apply`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
