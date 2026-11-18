// Shared bits for announcements, policies and the disciplinary file.
export const POLICY_CATEGORIES = ['Code of Conduct', 'Attendance', 'Leave', 'IT & Security', 'Health & Safety', 'Compensation', 'Other'];
export const CASE_CATEGORIES = ['Attendance', 'Conduct', 'Performance', 'Policy Breach', 'Other'];
export const CASE_ACTIONS = ['Counselling', 'Verbal Warning', 'Written Warning', 'Final Warning', 'Suspension', 'Termination'];
export const keyOf = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Save a downloaded blob under its name. */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name || 'document';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
