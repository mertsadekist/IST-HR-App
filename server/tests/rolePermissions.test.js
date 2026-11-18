import { describe, it, expect, afterEach } from 'vitest';
import {
  canAccessModule, modulesFor, defaultModulesFor, setRoleOverrides, MODULES,
} from '../config/permissions.js';

afterEach(() => setRoleOverrides({}));

describe('role permissions', () => {
  it('gives the HR specialist HR without payroll or settings', () => {
    expect(canAccessModule('hr_specialist', MODULES.HR)).toBe(true);
    expect(canAccessModule('hr_specialist', MODULES.PAYROLL)).toBe(false);
    expect(canAccessModule('hr_specialist', MODULES.OPERATIONS)).toBe(false);
  });
  it('lets an admin narrow or widen a role, and restore it', () => {
    setRoleOverrides({ accountant: ['payroll', 'portal'] });
    expect(canAccessModule('accountant', MODULES.ASSETS)).toBe(false);
    expect(modulesFor('accountant')).toEqual(['payroll', 'portal']);
    setRoleOverrides(JSON.stringify({ recruiter: ['recruitment', 'analytics'] }));
    expect(canAccessModule('recruiter', MODULES.ANALYTICS)).toBe(true);
    expect(canAccessModule('accountant', MODULES.ASSETS)).toBe(true);
    expect(defaultModulesFor('hr_manager')).toContain('operations');
  });
  it('never restricts the admin and ignores unknown roles and modules', () => {
    const clean = setRoleOverrides({ admin: [], ghost: ['hr'], employee: ['portal', 'nope'] });
    expect(clean).toEqual({ employee: ['portal'] });
    expect(canAccessModule('admin', MODULES.OPERATIONS)).toBe(true);
    expect(canAccessModule('ghost', MODULES.HR)).toBe(false);
  });
});
