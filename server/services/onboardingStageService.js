/**
 * Onboarding stage engine — the ordered gated state machine.
 *
 * Each stage has a validator(ctx) that returns an array of missing-requirement
 * strings. `advance()` is allowed only when the current stage's validator
 * returns []. Pure logic + DB reads via the passed connection/pool; no HTTP here.
 *
 * See docs/modules/onboarding_v2_redesign.md §2/§5.
 */

export const STAGES = [
  'DRAFT',
  'CV_UPLOADED',
  'UNDER_HR_REVIEW',
  'HR_APPROVED',
  'OFFER_SENT',
  'OFFER_ACCEPTED',
  'SIGNED_OFFER_UPLOADED',
  'DOCUMENTS_COLLECTION',
  'VISA_RESIDENCY',
  'BANK_DETAILS',
  'READY_FOR_EMPLOYMENT',
  'COMPLETED',
];

export const TERMINAL = ['COMPLETED', 'REJECTED', 'CANCELLED'];

export const STAGE_LABELS = {
  DRAFT: 'Draft',
  CV_UPLOADED: 'CV Uploaded',
  UNDER_HR_REVIEW: 'Under HR Review',
  HR_APPROVED: 'Approved by HR Manager',
  OFFER_SENT: 'Offer Sent',
  OFFER_ACCEPTED: 'Offer Accepted',
  SIGNED_OFFER_UPLOADED: 'Signed Offer Uploaded',
  DOCUMENTS_COLLECTION: 'Documents Collection',
  VISA_RESIDENCY: 'Visa / Residency Processing',
  BANK_DETAILS: 'Bank Details Completed',
  READY_FOR_EMPLOYMENT: 'Ready for Employment',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function nextStage(stage) {
  const i = STAGES.indexOf(stage);
  if (i === -1 || i === STAGES.length - 1) return null;
  return STAGES[i + 1];
}
export function stageIndex(stage) {
  return STAGES.indexOf(stage);
}

const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns the list of unmet requirements that block leaving `record.stage`.
 * `ctx` provides loader functions returning the related rows:
 *   { record, profile, approval, offers, signedOffer, documents, visaSteps, bank, visaNotApplicable }
 */
export function validateStage(stage, ctx) {
  const missing = [];
  const {
    record, profile, approval, offers = [], signedOffer,
    documents = [], visaSteps = [], bank, visaNotApplicable = false,
  } = ctx;

  switch (stage) {
    case 'DRAFT': {
      // To leave DRAFT a CV must be uploaded (profile.cv_file_id set)
      if (!profile || !profile.cv_file_id) missing.push('Upload the candidate CV');
      break;
    }
    case 'CV_UPLOADED': {
      // Extraction attempted (profile exists). Nothing else blocks reaching review.
      if (!profile) missing.push('CV not processed yet');
      break;
    }
    case 'UNDER_HR_REVIEW': {
      if (!profile) { missing.push('Candidate profile is empty'); break; }
      if (!profile.first_name) missing.push('First name is required');
      if (!profile.last_name) missing.push('Last name is required');
      if (!profile.email || !EMAIL_RE.test(profile.email)) missing.push('A valid email is required');
      if (!profile.phone) missing.push('Phone number is required');
      if (!profile.nationality) missing.push('Nationality is required');
      if (!profile.profile_verified) missing.push('Profile must be reviewed and verified');
      break;
    }
    case 'HR_APPROVED': {
      if (!approval || approval.decision !== 'Approved') missing.push('HR Manager approval is required');
      break;
    }
    case 'OFFER_SENT': {
      const sent = offers.filter((o) => ['Sent', 'Accepted', 'Rejected', 'Expired', 'Withdrawn'].includes(o.status));
      if (!sent.length) missing.push('Create and send an employment offer');
      break;
    }
    case 'OFFER_ACCEPTED': {
      const accepted = offers.some((o) => o.status === 'Accepted');
      if (!accepted) missing.push('An accepted offer is required to continue');
      break;
    }
    case 'SIGNED_OFFER_UPLOADED': {
      if (!signedOffer || !signedOffer.file_id) missing.push('Upload the signed offer document');
      else if (signedOffer.verification_status !== 'Verified') missing.push('Signed offer must be verified');
      break;
    }
    case 'DOCUMENTS_COLLECTION': {
      const required = documents.filter((d) => d.required);
      if (!required.length) missing.push('Document requirements not initialized');
      for (const d of required) {
        if (d.status === 'Expired') missing.push(`Document expired: ${d.label}`);
        else if (d.status !== 'Verified') missing.push(`Document not verified: ${d.label}`);
      }
      break;
    }
    case 'VISA_RESIDENCY': {
      if (visaNotApplicable) break; // admin flagged N/A
      const required = visaSteps.filter((s) => s.required);
      if (!required.length) missing.push('Visa steps not initialized (or mark stage Not Applicable)');
      for (const s of required) {
        if (s.status !== 'Completed' && s.status !== 'Approved') missing.push(`Visa step incomplete: ${s.label}`);
      }
      break;
    }
    case 'BANK_DETAILS': {
      if (!bank) { missing.push('Bank details are required'); break; }
      if (!bank.bank_name) missing.push('Bank name is required');
      if (!bank.account_holder_name) missing.push('Account holder name is required');
      if (!bank.account_number) missing.push('Account number is required');
      if (!bank.iban || !IBAN_RE.test(String(bank.iban).replace(/\s/g, '').toUpperCase())) missing.push('A valid IBAN is required');
      if (!bank.verified) missing.push('Bank details must be verified');
      break;
    }
    case 'READY_FOR_EMPLOYMENT': {
      // Final gate; ready to activate. No extra data required beyond prior stages.
      break;
    }
    default:
      break;
  }
  return missing;
}

/** Compute a 0-100 profile completeness score for the UI. */
export function profileCompleteness(profile) {
  if (!profile) return 0;
  const weighted = [
    ['first_name', 8], ['last_name', 8], ['email', 10], ['phone', 8], ['nationality', 6],
    ['address', 5], ['date_of_birth', 5], ['current_job_title', 8],
    ['education', 10], ['skills', 8], ['languages', 5], ['work_experience', 11],
    ['certifications', 4], ['total_experience_years', 4],
  ];
  let got = 0, total = 0;
  for (const [field, w] of weighted) {
    total += w;
    const v = profile[field];
    const present = Array.isArray(v) ? v.length > 0
      : (v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== '[]' && String(v) !== 'null');
    if (present) got += w;
  }
  return Math.round((got / total) * 100);
}

export function isValidIBAN(iban) {
  return IBAN_RE.test(String(iban || '').replace(/\s/g, '').toUpperCase());
}
