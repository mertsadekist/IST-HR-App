import api from './axios';

export const getRuns = (params) => api.get('/payroll/runs', { params });
export const getRun = (id) => api.get(`/payroll/runs/${id}`);
export const generateRun = (data) => api.post('/payroll/runs/generate', data);
export const approveRun = (id) => api.put(`/payroll/runs/${id}/approve`);
export const markPaid = (id) => api.put(`/payroll/runs/${id}/mark-paid`);
export const deleteRun = (id) => api.delete(`/payroll/runs/${id}`);
export const wpsReadiness = (id) => api.get(`/payroll/runs/${id}/wps-readiness`);
export const wpsExport = (id, force) => api.get(`/payroll/runs/${id}/wps-export`, {
  params: force ? { force: 1 } : {}, responseType: 'blob',
});
export const myPayslips = (params) => api.get('/payroll/payslips/my', { params });
export const employeePayslips = (employeeId, params) => api.get(`/payroll/payslips/${employeeId}`, { params });
