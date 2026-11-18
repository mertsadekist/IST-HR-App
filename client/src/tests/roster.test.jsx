import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// A day that was attended late and is also covered by a request: the cell
// stays "Late", but says the lateness is explained.
const DAY = (att, leave) => ({ shift: { working: true }, att, leave, holiday: null });
const late = { status: 'Late', check_in: '11:51', check_out: '18:07', late: 111 };
const data = {
  month: '2026-11', today: '2026-11-18', dates: ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'], schedules: [],
  employees: [{
    id: 1, company_id: 1, name: 'Test Person', department: 'HR', days: {
      '2026-11-09': DAY(late, null),
      '2026-11-10': DAY(late, { type: 'Late Working', color: null, status: 'Approved' }),
      '2026-11-11': DAY(late, { type: 'Late Working', color: null, status: 'Pending' }),
      '2026-11-12': DAY({ status: 'Present', check_in: '09:00', check_out: '18:00', late: null }, { type: 'Annual Leave', color: null, status: 'Approved' }),
    },
  }],
};

vi.mock('react-redux', () => ({ useSelector: (fn) => fn({ auth: { user: { role: 'admin' } }, entity: { currentCompanyId: 1 } }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, o) => (o?.type ? `${k}:${o.type}` : k) }),
}));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@api/attendanceApi', () => ({ roster: () => Promise.resolve({ data }), setShifts: vi.fn() }));

const { default: Roster } = await import('../pages/lifecycle/Roster');

describe('Roster — attended days covered by a request', () => {
  it('keeps the status but marks an approved excuse', async () => {
    render(<Roster />);
    const cell = await screen.findByTitle(/\(\+111\) · roster\.excused_by:Late Working/);
    expect(cell).toHaveTextContent('roster.abbr.late');
    expect(cell.className).toContain('outline-violet-500');
    expect(cell.className).not.toContain('outline-dashed');
  });

  it('shows a pending request as a dashed frame', async () => {
    render(<Roster />);
    const cell = await screen.findByTitle(/roster\.cover_pending:Late Working/);
    expect(cell.className).toContain('outline-dashed');
  });

  it('leaves a plain late day unmarked', async () => {
    render(<Roster />);
    const cells = await screen.findAllByTitle(/\(\+111\)$/);
    expect(cells).toHaveLength(1);
    expect(cells[0].className).not.toContain('outline-violet');
  });

  it('notes a request on a fully worked day without calling it an excuse', async () => {
    render(<Roster />);
    expect(await screen.findByTitle(/roster\.leave_on_day:Annual Leave/)).toBeInTheDocument();
  });
});
