import { describe, it, expect } from 'vitest';
import {
  notOwnerSql, notOwnerByIdSql, isOwnerEmployee, waiveOpenCasesFor,
} from '../services/ownerExemption.js';
import { OPEN_STATUSES } from '../config/attendanceExceptions.js';

/** A db whose query() records the call and returns a canned result. */
const fakeDb = (result) => {
  const calls = [];
  return { calls, query: async (sql, params) => { calls.push({ sql, params }); return result; } };
};

describe('owner exemption SQL fragments', () => {
  it('filters a joined employees alias', () => {
    expect(notOwnerSql('e')).toBe(' AND e.is_owner = FALSE');
    expect(notOwnerSql('emp')).toContain('emp.is_owner = FALSE');
  });

  it('filters by employee id without needing a join', () => {
    const sql = notOwnerByIdSql('x.employee_id');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('own.id = x.employee_id');
    expect(sql).toContain('own.is_owner = TRUE');
  });
});

describe('isOwnerEmployee', () => {
  it('is true only for an employee flagged as owner', async () => {
    expect(await isOwnerEmployee(fakeDb([[{ is_owner: 1 }]]), 5)).toBe(true);
    expect(await isOwnerEmployee(fakeDb([[{ is_owner: 0 }]]), 5)).toBe(false);
  });

  it('treats an unknown employee as not an owner', async () => {
    expect(await isOwnerEmployee(fakeDb([[undefined]]), 999)).toBe(false);
  });
});

describe('waiveOpenCasesFor', () => {
  it('waives only the cases still open, and reports how many', async () => {
    const db = fakeDb([{ affectedRows: 3 }]);
    expect(await waiveOpenCasesFor(db, 7)).toBe(3);
    const { sql, params } = db.calls[0];
    expect(sql).toContain("status = 'Waived'");
    // Cases a person already decided (Resolved / Waived) or the engine closed
    // must not be touched: only the open statuses are listed.
    expect(params).toEqual([7, ...OPEN_STATUSES]);
    expect(sql).not.toContain('Resolved');
  });
});
