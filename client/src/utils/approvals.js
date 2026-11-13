/** "Direct manager", "HR manager", "Ahmed" — what an approval step is, in the reader's language. */
export function stepLabel(t, s) {
  switch (s.type) {
    case 'direct_manager': return t('approvals.step_direct_manager');
    case 'second_manager': return t('approvals.step_second_manager');
    case 'role':
      return s.role === 'hr_manager' ? t('approvals.role_hr_manager')
        : s.role === 'accountant' ? t('approvals.role_accountant') : t('approvals.role_admin');
    case 'user': return s.approver_names?.[0] || t('approvals.step_user');
    default: return s.type;
  }
}
