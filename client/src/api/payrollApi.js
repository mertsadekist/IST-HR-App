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
// The server rebuilds the workbook and attaches it, so the file never makes a
// round trip through the browser on its way to the bank.
export const wpsSend = (id, data) => api.post(`/payroll/runs/${id}/wps-send`, data);
// The salary explanation workbook: why each employee was paid what they were.
// Available on a Draft run on purpose — it is meant to be read before approval.
export const explanationExport = (id) => api.get(`/payroll/runs/${id}/explanation`, { responseType: 'blob' });
export const myPayslips = (params) => api.get('/payroll/payslips/my', { params });
export const employeePayslips = (employeeId, params) => api.get(`/payroll/payslips/${employeeId}`, { params });

// ── Payroll v2 ────────────────────────────────────────────────────────────────
// Blocking checks, warnings and the comparison with the last approved run.
export const getReview = (id) => api.get(`/payroll/runs/${id}/review`);
// Draft → Pending Approval. An admin may pass override_reason past blocking checks.
export const submitRun = (id, data = {}) => api.put(`/payroll/runs/${id}/submit`, data);
// Pending Approval → Approved. The submitter needs self_approval_reason (admin only).
export const approveRunWith = (id, data = {}) => api.put(`/payroll/runs/${id}/approve`, data);
// Pending Approval → Draft, with a reason.
export const rejectRun = (id, reason) => api.put(`/payroll/runs/${id}/reject`, { reason });
export const notifyPayslips = (id) => api.post(`/payroll/runs/${id}/notify-payslips`);
// Allowance breakdown (housing, transport…) of an employee's contract total.
export const getComponentTypes = () => api.get('/payroll/component-types');
export const getEmployeeComponents = (employeeId) => api.get(`/payroll/employees/${employeeId}/components`);
export const saveEmployeeComponents = (employeeId, components) =>
  api.put(`/payroll/employees/${employeeId}/components`, { components });
