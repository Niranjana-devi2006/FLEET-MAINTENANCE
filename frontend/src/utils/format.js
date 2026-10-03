/** Shared display formatting helpers. */

export const formatCurrency = (value) => {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const formatNumber = (value, digits = 0) =>
  Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const formatKm = (value) => `${formatNumber(value)} km`;

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/** 'YYYY-MM-DD' for date inputs. */
export const toInputDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export const todayInput = () => toInputDate(new Date());

/** 'YYYY-MM' month key -> 'Mar 2025' */
export const formatMonth = (value) => {
  if (!value) return '';
  const [y, m] = value.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

/** Human phrasing for a signed day count. */
export const describeDays = (days) => {
  if (days === null || days === undefined) return '—';
  const n = Number(days);
  if (n < 0) return `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'} overdue`;
  if (n === 0) return 'Due today';
  return `in ${n} day${n === 1 ? '' : 's'}`;
};

/** Map a domain status to a badge colour class. */
export const statusBadge = (status) => {
  const map = {
    Available: 'badge-green',
    'On Trip': 'badge-blue',
    'Under Maintenance': 'badge-amber',
    'Out of Service': 'badge-red',

    Active: 'badge-green',
    Inactive: 'badge-slate',
    Suspended: 'badge-red',

    Scheduled: 'badge-purple',
    Ongoing: 'badge-blue',
    Completed: 'badge-green',
    Cancelled: 'badge-slate',
    'In Progress': 'badge-amber',
    Open: 'badge-red',

    Unread: 'badge-blue',
    Read: 'badge-slate',
    Resolved: 'badge-green',

    Low: 'badge-slate',
    Medium: 'badge-blue',
    High: 'badge-amber',
    Critical: 'badge-red',
  };
  return map[status] || 'badge-slate';
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';
