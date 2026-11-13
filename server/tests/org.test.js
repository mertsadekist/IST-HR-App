/**
 * Reporting lines. Pure unit tests: no database.
 */
import { describe, it, expect } from 'vitest';
import { wouldCreateCycle, teamOf, buildTree } from '../services/orgService.js';

// 1 CEO ← 2 Head ← 3, 4 ; 4 ← 5
const rows = [
  { id: 1, name: 'Ceo', manager_employee_id: null },
  { id: 2, name: 'Head', manager_employee_id: 1 },
  { id: 3, name: 'Ali', manager_employee_id: 2 },
  { id: 4, name: 'Bana', manager_employee_id: 2 },
  { id: 5, name: 'Cara', manager_employee_id: 4 },
  { id: 6, name: 'Loose', manager_employee_id: null },
];
const managerOf = new Map(rows.map((r) => [r.id, r.manager_employee_id]));

describe('wouldCreateCycle', () => {
  it('refuses managing yourself, directly or through a chain', () => {
    expect(wouldCreateCycle(2, 2, managerOf)).toBe(true);
    expect(wouldCreateCycle(2, 5, managerOf)).toBe(true); // 5 → 4 → 2
    expect(wouldCreateCycle(1, 3, managerOf)).toBe(true);
  });
  it('allows a sideways or upward move, and clearing the manager', () => {
    expect(wouldCreateCycle(5, 3, managerOf)).toBe(false);
    expect(wouldCreateCycle(3, 1, managerOf)).toBe(false);
    expect(wouldCreateCycle(3, null, managerOf)).toBe(false);
  });
  it('does not loop forever on a graph that already has a cycle', () => {
    const bad = new Map([[7, 8], [8, 7]]);
    expect(wouldCreateCycle(9, 7, bad)).toBe(false);
  });
});

describe('teamOf', () => {
  it('finds direct and indirect reports with their depth', () => {
    expect([...teamOf(2, rows)]).toEqual([[3, 1], [4, 1], [5, 2]]);
    expect(teamOf(1, rows).size).toBe(4);
  });
  it('stops at the depth limit and is empty for someone with no reports', () => {
    expect([...teamOf(1, rows, 1)]).toEqual([[2, 1]]);
    expect(teamOf(3, rows).size).toBe(0);
  });
});

describe('buildTree', () => {
  it('nests people under their managers, managers first among roots', () => {
    const tree = buildTree(rows);
    expect(tree.map((n) => n.id)).toEqual([1, 6]);
    expect(tree[0].reports[0].reports.map((n) => n.name)).toEqual(['Ali', 'Bana']);
    expect(tree[0].reports[0].reports[1].reports[0].name).toBe('Cara');
  });
  it('makes someone whose manager is outside the selection a root', () => {
    expect(buildTree(rows.filter((r) => r.id !== 2)).map((n) => n.id).sort()).toEqual([1, 3, 4, 6]);
  });
});
