import api from './axios';

export const getSchedules = (params) => api.get('/work-schedules', { params });
export const getSchedule = (id) => api.get(`/work-schedules/${id}`);
export const createSchedule = (data) => api.post('/work-schedules', data);
export const updateSchedule = (id, data) => api.put(`/work-schedules/${id}`, data);
export const deleteSchedule = (id) => api.delete(`/work-schedules/${id}`);

// Who is on which schedule, and who is still on nothing.
export const getCoverage = (params) => api.get('/work-schedules/coverage', { params });
export const getAssignments = (employeeId) => api.get(`/work-schedules/assignments/${employeeId}`);
export const assignSchedule = (data) => api.post('/work-schedules/assignments', data);
export const removeAssignment = (id) => api.delete(`/work-schedules/assignments/${id}`);

export const getHolidays = (params) => api.get('/work-schedules/holidays', { params });
export const createHoliday = (data) => api.post('/work-schedules/holidays', data);
export const updateHoliday = (id, data) => api.put(`/work-schedules/holidays/${id}`, data);
export const deleteHoliday = (id) => api.delete(`/work-schedules/holidays/${id}`);
