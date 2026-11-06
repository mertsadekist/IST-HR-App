// Shared by the employee Documents tab and the Document Radar page, so the two
// never disagree on what a type is called or how urgent a date looks.
// Values mirror EMPLOYEE_DOC_TYPES in server/services/employeeDocumentExpiryService.js.

export const EMPLOYEE_DOC_TYPES = [
  'Passport', 'Residence Visa', 'Emirates ID', 'Labour Card', 'Health Insurance', 'Other ID',
];

export function docTypeLabel(t, type) {
  switch (type) {
    case 'Passport': return t('empDocs.type_passport');
    case 'Residence Visa': return t('empDocs.type_residence_visa');
    case 'Emirates ID': return t('empDocs.type_emirates_id');
    case 'Labour Card': return t('empDocs.type_labour_card');
    case 'Health Insurance': return t('empDocs.type_health_insurance');
    case 'Other ID': return t('empDocs.type_other_id');
    default: return type || '';
  }
}

/** Badge variant + words for a document's days left (null = no date). */
export function expiryBadge(t, daysLeft) {
  if (daysLeft == null) return { variant: 'inactive', text: t('empDocs.no_expiry') };
  if (daysLeft < 0) return { variant: 'danger', text: t('docs.exp_expired_ago', { days: Math.abs(daysLeft) }) };
  if (daysLeft === 0) return { variant: 'danger', text: t('docs.exp_today') };
  if (daysLeft <= 30) return { variant: 'danger', text: t('docs.exp_days_left', { days: daysLeft }) };
  if (daysLeft <= 90) return { variant: 'warning', text: t('docs.exp_days_left', { days: daysLeft }) };
  return { variant: 'success', text: t('docs.exp_days_left', { days: daysLeft }) };
}
