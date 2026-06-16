import { describe, it, expect } from 'vitest';
import { STAGES, nextStage, validateStage, profileCompleteness, isValidIBAN } from '../services/onboardingStageService.js';

describe('Onboarding stage engine', () => {
  it('has the 12 forward stages in order', () => {
    expect(STAGES[0]).toBe('DRAFT');
    expect(STAGES[STAGES.length - 1]).toBe('COMPLETED');
    expect(nextStage('DRAFT')).toBe('CV_UPLOADED');
    expect(nextStage('OFFER_SENT')).toBe('OFFER_ACCEPTED');
    expect(nextStage('COMPLETED')).toBe(null);
  });

  it('DRAFT requires a CV before advancing', () => {
    expect(validateStage('DRAFT', { profile: null })).toContain('Upload the candidate CV');
    expect(validateStage('DRAFT', { profile: { cv_file_id: 5 } })).toEqual([]);
  });

  it('UNDER_HR_REVIEW requires complete + verified profile', () => {
    const incomplete = validateStage('UNDER_HR_REVIEW', { profile: { first_name: 'A', email: 'bad', profile_verified: 0 } });
    expect(incomplete).toContain('Last name is required');
    expect(incomplete).toContain('A valid email is required');
    expect(incomplete).toContain('Profile must be reviewed and verified');

    const ok = validateStage('UNDER_HR_REVIEW', {
      profile: { first_name: 'A', last_name: 'B', email: 'a@b.com', phone: '123456', nationality: 'UAE', profile_verified: 1 },
    });
    expect(ok).toEqual([]);
  });

  it('HR_APPROVED requires an Approved decision', () => {
    expect(validateStage('HR_APPROVED', { approval: { decision: 'Pending' } })).toContain('HR Manager approval is required');
    expect(validateStage('HR_APPROVED', { approval: { decision: 'Approved' } })).toEqual([]);
  });

  it('OFFER_ACCEPTED requires an accepted offer', () => {
    expect(validateStage('OFFER_ACCEPTED', { offers: [{ status: 'Sent' }] })).toContain('An accepted offer is required to continue');
    expect(validateStage('OFFER_ACCEPTED', { offers: [{ status: 'Accepted' }] })).toEqual([]);
  });

  it('SIGNED_OFFER_UPLOADED requires a verified signed offer', () => {
    expect(validateStage('SIGNED_OFFER_UPLOADED', { signedOffer: { file_id: 1, verification_status: 'Pending' } }))
      .toContain('Signed offer must be verified');
    expect(validateStage('SIGNED_OFFER_UPLOADED', { signedOffer: { file_id: 1, verification_status: 'Verified' } })).toEqual([]);
  });

  it('DOCUMENTS_COLLECTION blocks on unverified/expired required docs', () => {
    const docs = [
      { required: 1, status: 'Verified', label: 'Passport' },
      { required: 1, status: 'Uploaded', label: 'Photo' },
      { required: 0, status: 'Missing', label: 'Experience cert' },
    ];
    const miss = validateStage('DOCUMENTS_COLLECTION', { documents: docs });
    expect(miss).toContain('Document not verified: Photo');
    expect(miss.some((m) => m.includes('Experience cert'))).toBe(false); // optional doc ignored
  });

  it('VISA_RESIDENCY can be skipped when flagged Not Applicable', () => {
    expect(validateStage('VISA_RESIDENCY', { visaSteps: [], visaNotApplicable: true })).toEqual([]);
    expect(validateStage('VISA_RESIDENCY', { visaSteps: [{ required: 1, status: 'In Progress', label: 'Medical' }] }))
      .toContain('Visa step incomplete: Medical');
  });

  it('BANK_DETAILS validates IBAN and verification', () => {
    const bad = validateStage('BANK_DETAILS', { bank: { bank_name: 'X', account_holder_name: 'Y', account_number: '1', iban: 'NOPE', verified: 0 } });
    expect(bad).toContain('A valid IBAN is required');
    expect(bad).toContain('Bank details must be verified');
    const ok = validateStage('BANK_DETAILS', { bank: { bank_name: 'X', account_holder_name: 'Y', account_number: '1', iban: 'AE070331234567890123456', verified: 1 } });
    expect(ok).toEqual([]);
  });

  it('profileCompleteness scales 0..100', () => {
    expect(profileCompleteness(null)).toBe(0);
    expect(profileCompleteness({})).toBe(0);
    const full = profileCompleteness({
      first_name: 'A', last_name: 'B', email: 'a@b.com', phone: '1', nationality: 'UAE',
      address: 'x', date_of_birth: '1990-01-01', current_job_title: 'Dev',
      education: [{}], skills: ['a'], languages: ['en'], work_experience: [{}],
      certifications: ['c'], total_experience_years: 5,
    });
    expect(full).toBe(100);
  });

  it('isValidIBAN accepts UAE IBAN and rejects junk', () => {
    expect(isValidIBAN('AE07 0331 2345 6789 0123 456')).toBe(true);
    expect(isValidIBAN('hello')).toBe(false);
  });
});
