import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AttendanceReport from '../pages/portal/components/AttendanceReport';

const company = { id: 1, name: 'IST Markets LTD', short_code: 'ISTMRKT' };
const rows = [
  { id: 3, work_date: '2026-07-03', check_in: null, check_out: null, work_hours: 0, status: 'Absent', notes: 'No show' },
  { id: 1, work_date: '2026-07-01', check_in: '09:02', check_out: '18:05', work_hours: 9.05, status: 'Present', notes: null },
  { id: 2, work_date: '2026-07-02', check_in: '09:41', check_out: '18:00', work_hours: 8.32, status: 'Late', notes: null },
];
const summary = {
  month: '2026-07',
  by_status: [{ status: 'Present', count: 1 }, { status: 'Late', count: 1 }, { status: 'Absent', count: 1 }],
  total_hours: 17.37,
};

const setup = (props = {}) => render(
  <AttendanceReport employeeName="Mert Sadek" company={company} month="2026-07"
    rows={rows} summary={summary} {...props} />
);

describe('AttendanceReport (printable)', () => {
  it('names the employee, company and month being reported', () => {
    setup();
    expect(screen.getByText('Mert Sadek')).toBeInTheDocument();
    expect(screen.getAllByText('IST Markets LTD').length).toBeGreaterThan(0);
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  it('carries the per-status counts and the total hours', () => {
    // Scoped to the summary table: the status labels also appear on every row
    // of the daily record below it.
    const { container } = setup();
    const summaryTable = container.querySelectorAll('table')[1];
    expect(within(summaryTable).getByText('Present / حاضر')).toBeInTheDocument();
    expect(within(summaryTable).getByText('Absent / غائب')).toBeInTheDocument();
    expect(within(summaryTable).getByText('Total hours / الساعات')).toBeInTheDocument();
    expect(within(summaryTable).getByText('17.37')).toBeInTheDocument();
  });

  it('lists the days oldest first, unlike the on-screen list', () => {
    const { container } = setup();
    const bodies = container.querySelectorAll('tbody');
    const dailyRows = bodies[bodies.length - 1].querySelectorAll('tr');
    expect(dailyRows).toHaveLength(3);
    expect(within(dailyRows[0]).getByText('2026-07-01')).toBeInTheDocument();
    expect(within(dailyRows[2]).getByText('2026-07-03')).toBeInTheDocument();
  });

  it('shows check-in and check-out verbatim, and a dash where there is none', () => {
    setup();
    expect(screen.getByText('09:02')).toBeInTheDocument();
    expect(screen.getByText('18:05')).toBeInTheDocument();
    // The absent day has neither time.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('No show')).toBeInTheDocument();
  });

  it('drops its own company header when composed onto a letterhead', () => {
    const { rerender } = setup({ onLetterhead: false });
    expect(screen.getByText('ISTMRKT')).toBeInTheDocument();
    rerender(<AttendanceReport employeeName="Mert Sadek" company={company} month="2026-07"
      rows={rows} summary={summary} onLetterhead />);
    // The short code only appears in the header the letterhead replaces.
    expect(screen.queryByText('ISTMRKT')).not.toBeInTheDocument();
    expect(screen.getByText('Attendance Report')).toBeInTheDocument();
  });

  it('renders an empty month without crashing', () => {
    render(<AttendanceReport employeeName="Nobody" company={company} month="2026-01"
      rows={[]} summary={{ by_status: [], total_hours: 0 }} />);
    expect(screen.getByText(/No attendance recorded/)).toBeInTheDocument();
    expect(screen.getByText('January 2026')).toBeInTheDocument();
  });

  it('falls back to summing the rows when no summary is supplied', () => {
    render(<AttendanceReport employeeName="Mert Sadek" company={company} month="2026-07" rows={rows} />);
    expect(screen.getByText('17.37')).toBeInTheDocument();
  });
});
