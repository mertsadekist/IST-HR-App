/**
 * The two ways a generated letter used to go out wrong.
 *
 * The Salary Certificate that prompted these: dated "[Insert Date]", and calling
 * an employee "she" on the strength of the name alone. Both reached a bank.
 */
import { describe, it, expect } from 'vitest';
import {
  formatLetterDate, todayIso, neutralizeGender, fillPlaceholders,
  ensureDated, finalizeLetter,
} from '../services/letterWriting.js';

describe('formatLetterDate', () => {
  it('reads the date given, not the day before', () => {
    // `new Date('2026-09-09')` is UTC midnight, which is 8 September anywhere
    // west of Greenwich. A letter dated a day early is a wrong letter.
    expect(formatLetterDate('2026-09-09')).toBe('9 September 2026');
    expect(formatLetterDate('2026-01-01')).toBe('1 January 2026');
    expect(formatLetterDate('2026-12-31')).toBe('31 December 2026');
  });

  it('accepts a full datetime and ignores the time', () => {
    expect(formatLetterDate('2026-08-31T20:00:00.000Z')).toBe('31 August 2026');
  });

  it('falls back to today rather than returning nothing', () => {
    expect(formatLetterDate(null)).toBe(formatLetterDate(todayIso()));
  });

  it('returns empty for something that is not a date', () => {
    expect(formatLetterDate('not a date')).toBe('');
    expect(formatLetterDate('2026-13-01')).toBe('');
  });
});

describe('neutralizeGender', () => {
  it('rewrites the certificate that went out about Maiar', () => {
    const draft = 'This is to certify that Maiar Barshiny is employed with IST Real Estate LLC.'
      + ' She has been a member of our organization since January 1, 2012.'
      + ' Her current monthly basic salary is AED 25,000.00.';
    const out = neutralizeGender(draft, { name: 'Maiar Barshiny' });
    expect(out).not.toMatch(/\b(?:she|her|his|he|him)\b/i);
    expect(out).toContain('The employee has been a member');
    expect(out).toContain("The employee's current monthly basic salary");
  });

  it('handles the hedged forms too', () => {
    const out = neutralizeGender('He/She reports to the Manager. His/Her duties include sales. '
      + 'Contact him/her directly.');
    expect(out).toBe('The employee reports to the Manager. '
      + "The employee's duties include sales. Contact the employee directly.");
  });

  it('tells possessive "her" from object "her"', () => {
    expect(neutralizeGender('Her salary is AED 5,000.')).toBe("The employee's salary is AED 5,000.");
    expect(neutralizeGender('This is issued at her request.')).toBe("This is issued at the employee's request.");
    expect(neutralizeGender('Please contact her.')).toBe('Please contact the employee.');
  });

  it('keeps the salutation to the recipient, which is not about the employee', () => {
    const out = neutralizeGender('Dear Sir/Madam,\n\nThis is to certify...', { name: 'Maiar Barshiny' });
    expect(out).toContain('Dear Sir/Madam,');
  });

  it('drops a title in front of the employee but not in front of anyone else', () => {
    const out = neutralizeGender('Attention: Mr. John Carter (First Abu Dhabi Bank)\n'
      + 'This certifies that Ms. Maiar Barshiny is employed with us.', { name: 'Maiar Barshiny' });
    expect(out).toContain('Mr. John Carter');
    expect(out).toContain('that Maiar Barshiny is employed');
    expect(out).not.toContain('Ms. Maiar');
  });

  it('preserves capitalisation at the start of a sentence', () => {
    expect(neutralizeGender('She resigned. she was paid.'))
      .toBe('The employee resigned. the employee was paid.');
  });

  it('leaves a letter that was already written properly alone', () => {
    const clean = 'The employee has been with IST Markets since 2019 and continues to serve'
      + ' in this capacity on a full-time basis.';
    expect(neutralizeGender(clean, { name: 'Subrat Nath Poudyal' })).toBe(clean);
  });

  it('does not trip over ordinary words that merely contain a pronoun', () => {
    const s = 'The Head of Sales shelved the matter; her colleague, Sheikh Zayed Road office.';
    const out = neutralizeGender(s);
    expect(out).toContain('shelved');
    expect(out).toContain('Sheikh Zayed Road');
  });
});

describe('fillPlaceholders', () => {
  it('fills the bracketed date the model leaves behind', () => {
    expect(fillPlaceholders('Date: [Insert Date]', { date: '9 September 2026' }))
      .toBe('Date: 9 September 2026');
    expect(fillPlaceholders('Date: [DATE]', { date: '9 September 2026' }))
      .toBe('Date: 9 September 2026');
    expect(fillPlaceholders("Dated [Today's Date] at Dubai", { date: '9 September 2026' }))
      .toBe('Dated 9 September 2026 at Dubai');
  });

  it('fills the other placeholders it holds a value for', () => {
    const out = fillPlaceholders('[Employee Name], [Job Title], [Department] at [Company Name].', {
      employee_name: 'Maiar Barshiny',
      job_title: 'Head of Management',
      department: 'Operations',
      company_name: 'IST Real Estate LLC',
    });
    expect(out).toBe('Maiar Barshiny, Head of Management, Operations at IST Real Estate LLC.');
  });

  it('leaves a placeholder it cannot fill visible rather than deleting the line', () => {
    const out = fillPlaceholders('Reference: [Passport Number]', { date: '9 September 2026' });
    expect(out).toContain('[Passport Number]');
  });
});

describe('ensureDated', () => {
  it('adds a date when the draft came back without one', () => {
    expect(ensureDated('To Whom It May Concern,', '9 September 2026'))
      .toBe('Date: 9 September 2026\n\nTo Whom It May Concern,');
  });

  it('does not add a second one', () => {
    const already = 'To: First Abu Dhabi Bank\n\nDate: 9 September 2026\n\nDear Sir/Madam,';
    expect(ensureDated(already, '9 September 2026')).toBe(already);
  });

  it('is not fooled by a date deep in the body', () => {
    // "since January 1, 2012" is the start date, not the letter's own date.
    const body = ['Dear Sir/Madam,', '', 'This is to certify that the employee',
      'has been with us since 1 January 2012 and continues', 'to serve in this capacity.',
      '', 'Yours faithfully,'].join('\n');
    expect(ensureDated(body, '1 January 2012')).toMatch(/^Date: 1 January 2012/);
  });
});

describe('finalizeLetter', () => {
  it('repairs the exact draft that prompted this', () => {
    const draft = [
      'To: First Abu Dhabi Bank',
      '',
      'Date: [Insert Date]',
      '',
      'Subject: Salary Certificate for Maiar Barshiny',
      '',
      'Dear Sir/Madam,',
      '',
      'This is to certify that Maiar Barshiny is employed with IST Real Estate LLC,'
        + ' holding the position of Head of Management. She has been a member of our'
        + ' organization since January 1, 2012.',
      '',
      'Her current monthly basic salary is AED 25,000.00. This certificate is issued'
        + ' upon her request.',
      '',
      'Yours faithfully,',
    ].join('\n');

    const out = finalizeLetter(draft, {
      date: '9 September 2026',
      employee_name: 'Maiar Barshiny',
      company_name: 'IST Real Estate LLC',
    });

    expect(out).not.toContain('[Insert Date]');
    expect(out).toContain('Date: 9 September 2026');
    expect(out).not.toMatch(/\b(?:she|her|hers)\b/i);
    expect(out).toContain('The employee has been a member');
    expect(out).toContain("The employee's current monthly basic salary is AED 25,000.00");
    expect(out).toContain("issued upon the employee's request");
    expect(out).toContain('Dear Sir/Madam,');
    expect(out).toContain('First Abu Dhabi Bank');
  });

  it('survives an empty draft without throwing', () => {
    expect(finalizeLetter('', { date: '9 September 2026' })).toBe('Date: 9 September 2026');
  });
});
