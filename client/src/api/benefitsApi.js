import api from './axios';

// Benefits: group insurance policies, enrolment and dependents, air ticket entitlement.
export const getPolicies = () => api.get('/benefits/policies');
export const createPolicy = (data) => api.post('/benefits/policies', data);
export const updatePolicy = (id, data) => api.put(`/benefits/policies/${id}`, data);
export const deletePolicy = (id) => api.delete(`/benefits/policies/${id}`);
export const getEmployeeBenefits = (employeeId) => api.get(`/benefits/employees/${employeeId}`);
export const getMyBenefits = () => api.get('/benefits/mine');
export const saveInsurance = (employeeId, data) => api.put(`/benefits/employees/${employeeId}/insurance`, data);
export const saveTicket = (employeeId, data) => api.put(`/benefits/employees/${employeeId}/ticket`, data);
export const addTicketUsage = (employeeId, data) => api.post(`/benefits/employees/${employeeId}/ticket-usage`, data);
export const deleteTicketUsage = (id) => api.delete(`/benefits/ticket-usage/${id}`);
export const getOverview = () => api.get('/benefits/overview');
