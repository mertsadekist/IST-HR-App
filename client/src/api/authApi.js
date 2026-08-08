import api from './axios';

export const login = (username, password) => api.post('/auth/login', { username, password });
export const me = () => api.get('/auth/me');
// Hands the admin their own account back. The identity to return to comes
// from the token's claim, never from here.
export const stopImpersonation = () => api.post('/auth/stop-impersonation');
