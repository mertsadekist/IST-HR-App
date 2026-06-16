import api from './axios';

export const getRuns = () => api.get('/payroll/runs');
export const getRun = (id) => api.get(`/payroll/runs/${id}`);
export const generateRun = (data) => api.post('/payroll/runs/generate', data);
export const approveRun = (id) => api.put(`/payroll/runs/${id}/approve`);
export const markPaid = (id) => api.put(`/payroll/runs/${id}/mark-paid`);
export const deleteRun = (id) => api.delete(`/payroll/runs/${id}`);
export const myPayslips = (params) => api.get('/payroll/payslips/my', { params });
export const employeePayslips = (employeeId, params) => api.get(`/payroll/payslips/${employeeId}`, { params });
