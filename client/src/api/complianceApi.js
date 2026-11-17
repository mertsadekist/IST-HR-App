import api from './axios';

// Compliance: what needs attention, the month's deadlines, Emiratisation.
export const getAttention = () => api.get('/compliance/attention');
export const getCalendar = (month) => api.get('/compliance/calendar', { params: { month } });
export const getEmiratisation = (year) => api.get('/compliance/emiratisation', { params: { year } });
export const setLawValue = (data) => api.put('/compliance/law-values', data);
