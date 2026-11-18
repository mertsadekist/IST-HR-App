import api from './axios';

// Which modules each role may open (Settings → Roles). Admin only, except /me.
export const getRoles = () => api.get('/roles');
export const saveRole = (role, modules) => api.put(`/roles/${role}`, { modules });
export const myModules = () => api.get('/roles/me');
