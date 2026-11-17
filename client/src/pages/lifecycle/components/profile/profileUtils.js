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

/**
 * How urgent a document's expiry is, on the same 90/60/30-day steps the HR
 * reminders use. `null` days = no expiry date.
 */
export function expiryTier(daysLeft) {
  if (daysLeft == null) return { key: 'none', tone: 'neutral' };
  if (daysLeft < 0) return { key: 'expired', tone: 'red' };
  if (daysLeft === 0) return { key: 'today', tone: 'red' };
  if (daysLeft <= 30) return { key: '30', tone: 'red' };
  if (daysLeft <= 60) return { key: '60', tone: 'orange' };
  if (daysLeft <= 90) return { key: '90', tone: 'amber' };
  return { key: 'valid', tone: 'green' };
}

export function tierLabel(t, daysLeft) {
  switch (expiryTier(daysLeft).key) {
    case 'expired': return t('empProfile.tier_expired', { n: Math.abs(daysLeft) });
    case 'today': return t('empProfile.tier_today');
    case '30': return t('empProfile.tier_30');
    case '60': return t('empProfile.tier_60');
    case '90': return t('empProfile.tier_90');
    case 'valid': return t('empProfile.tier_valid');
    default: return t('empDocs.no_expiry');
  }
}

export const TIER_STYLES = {
  red: { pill: 'bg-red-100 text-red-700 ring-red-200', bar: 'bg-red-500', card: 'border-red-200 bg-red-50/40', dot: 'bg-red-500' },
  orange: { pill: 'bg-orange-100 text-orange-700 ring-orange-200', bar: 'bg-orange-500', card: 'border-orange-200 bg-orange-50/40', dot: 'bg-orange-500' },
  amber: { pill: 'bg-amber-100 text-amber-800 ring-amber-200', bar: 'bg-amber-500', card: 'border-amber-200 bg-amber-50/40', dot: 'bg-amber-500' },
  green: { pill: 'bg-emerald-100 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', card: 'border-surface-200 bg-white', dot: 'bg-emerald-500' },
  neutral: { pill: 'bg-surface-100 text-surface-600 ring-surface-200', bar: 'bg-surface-300', card: 'border-surface-200 bg-white', dot: 'bg-surface-300' },
};

// Stored employee documents have no extension on disk, so the download comes
// back as application/octet-stream; the type is taken from the original name.
const MIME = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', txt: 'text/plain',
};
export const fileExt = (name) => String(name || '').split('.').pop().toLowerCase().trim();
export const mimeFromName = (name) => MIME[fileExt(name)] || null;
/** 'image' | 'pdf' | 'text' | null — what the browser can show inline. */
export function previewKind(name) {
  const m = mimeFromName(name);
  if (!m) return null;
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  return 'text';
}

/**
 * The current document of each official type: the one expiring last, i.e. the
 * renewal, not the copy it replaced.
 */
export function currentByType(docs) {
  const map = {};
  for (const d of docs || []) {
    if (!d.doc_type) continue;
    const prev = map[d.doc_type];
    const later = !prev
      || (d.expiry_date || '') > (prev.expiry_date || '')
      || ((d.expiry_date || '') === (prev.expiry_date || '') && String(d.created_at) > String(prev.created_at));
    if (later) map[d.doc_type] = d;
  }
  return map;
}

/**
 * Every document whose expiry needs attention (expired, or within 90 days),
 * most urgent first. Only the current document of a type counts: an old visa
 * that has been renewed is not an alert.
 */
export function expiryAlerts(docs) {
  const current = new Set(Object.values(currentByType(docs)).map((d) => d.id));
  return (docs || [])
    .filter((d) => d.expiry_date && d.days_left != null && d.days_left <= 90)
    .filter((d) => !d.doc_type || current.has(d.id))
    .sort((a, b) => a.days_left - b.days_left);
}

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
