// Shared bits for portal requests (pages/portal/MyRequests, pages/lifecycle/EmployeeRequests).

export const REQUEST_TYPES = ['letter', 'expense', 'advance', 'case'];
export const LETTER_TYPES = ['Salary Certificate', 'NOC', 'Employment Confirmation', 'Experience Certificate'];
export const EXPENSE_CATEGORIES = ['Travel', 'Transport', 'Meals', 'Supplies', 'Phone', 'Training', 'Other'];
export const CASE_CATEGORIES = ['Payroll', 'Leave', 'Attendance', 'Documents', 'Workplace', 'IT', 'Other'];
export const CASE_STATUSES = ['Pending', 'In Progress', 'Resolved', 'Closed'];
export const OPEN_STATUSES = ['Pending', 'In Progress'];

/** Translation key fragment for a value like 'Salary Certificate' or 'In Progress'. */
export const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const statusVariant = (s) => ({
  Pending: 'warning', 'In Progress': 'info', Approved: 'active', Completed: 'success', Resolved: 'success',
  Rejected: 'danger', Closed: 'inactive', Cancelled: 'inactive',
}[s] || 'info');

export const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A request's title in the reader's language where it is one of ours. */
export function requestTitle(t, r) {
  if (r.type === 'letter') return t(`requests.letter_type.${slug(r.details?.letter_type)}`);
  if (r.type === 'advance') return t('requests.type.advance');
  if (r.type === 'expense') return `${t(`requests.expense_cat.${r.details?.category}`)}: ${r.details?.description || ''}`;
  return r.title;
}

/** Save a downloaded blob under its name. */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name || 'document';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
