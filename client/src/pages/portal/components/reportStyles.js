/**
 * Table styling for the printable portal reports.
 *
 * Kept apart from the components that use it because html2canvas needs inline
 * styles (Tailwind classes are not resolved during capture), and a module that
 * exports both components and plain values breaks fast refresh.
 */
export const cell = { padding: '6px 10px', border: '1px solid #eee', fontSize: '11px' };
export const headCell = { ...cell, background: '#f4f2fb', fontWeight: 'bold', color: '#4c1d95', textAlign: 'left' };
export const labelCell = { ...cell, background: '#fafafa', fontWeight: 600 };
export const totalCell = { ...cell, background: '#f4f2fb', fontWeight: 'bold' };

export const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
