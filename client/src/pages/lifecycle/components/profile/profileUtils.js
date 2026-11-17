import dayjs from 'dayjs';

// Stored values stay English (the server filters on them); only labels change.
// Written out so every key is visible to the i18n audit.
export function statusLabel(t, s) {
  switch (s) {
    case 'Onboarding': return t('empProfile.st_onboarding');
    case 'Active': return t('empProfile.st_active');
    case 'Offboarding': return t('empProfile.st_offboarding');
    case 'Exited': return t('empProfile.st_exited');
    default: return s || '';
  }
}

export const statusVariant = (s) => (
  s === 'Active' ? 'success' : s === 'Onboarding' ? 'info' : s === 'Offboarding' ? 'warning' : 'inactive'
);

export function runStatusLabel(t, s) {
  switch (s) {
    case 'Draft': return t('empProfile.run_draft');
    case 'Pending Approval': return t('empProfile.run_pending');
    case 'Approved': return t('empProfile.run_approved');
    case 'Paid': return t('empProfile.run_paid');
    default: return s || '';
  }
}

export function attendanceStatusLabel(t, s) {
  switch (s) {
    case 'Present': return t('portal.at_present');
    case 'Absent': return t('portal.at_absent');
    case 'Late': return t('portal.at_late');
    case 'Half Day': return t('portal.at_half_day');
    case 'On Leave': return t('portal.at_on_leave');
    case 'Holiday': return t('portal.at_holiday');
    case 'Remote': return t('portal.at_remote');
    default: return s || '';
  }
}

export const attendanceTone = {
  Present: 'active', Remote: 'info', Late: 'warning',
  'Half Day': 'warning', Absent: 'danger', 'On Leave': 'brand', Holiday: 'inactive',
};

export const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole years and remaining months since the start date, or null without one. */
export function tenure(startDate) {
  if (!startDate) return null;
  const start = dayjs(startDate);
  if (!start.isValid() || start.isAfter(dayjs())) return { years: 0, months: 0 };
  const months = dayjs().diff(start, 'month');
  return { years: Math.floor(months / 12), months: months % 12 };
}

export function tenureText(t, startDate) {
  const tn = tenure(startDate);
  if (!tn) return t('empProfile.not_set');
  return t('empProfile.tenure_value', { years: tn.years, months: tn.months });
}
