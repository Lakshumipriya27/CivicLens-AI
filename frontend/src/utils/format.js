export const CATEGORY_LABELS = {
  pothole_road_damage: 'Pothole / Road Damage',
  garbage_overflow: 'Overflowing Garbage Bin',
  illegal_dumping: 'Illegal Garbage Dumping',
  blocked_drainage: 'Blocked Drainage',
  water_leakage: 'Water Leakage',
  damaged_infrastructure: 'Damaged Public Infrastructure',
  broken_streetlight: 'Broken Streetlight',
  unsafe_pathway: 'Unsafe Public Pathway',
  other: 'Other / Unclear',
};

export const STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  reopened: 'Reopened',
};

export const STATUS_FLOW = ['submitted', 'under_review', 'acknowledged', 'in_progress', 'resolved'];

export const STATUS_TRANSITIONS = {
  submitted: ['under_review', 'acknowledged', 'in_progress', 'resolved'],
  under_review: ['acknowledged', 'in_progress', 'resolved'],
  acknowledged: ['under_review', 'in_progress', 'resolved'],
  in_progress: ['acknowledged', 'resolved'],
  resolved: ['reopened'],
  reopened: ['under_review', 'acknowledged', 'in_progress', 'resolved'],
};

export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const PRIORITY_LEVELS = ['critical', 'high', 'moderate', 'low'];

// Category colours: muted, distinguishable, used for chart bars and map report dots.
export const CATEGORY_COLORS = {
  pothole_road_damage: '#475569',
  garbage_overflow: '#7c5e10',
  illegal_dumping: '#9a6b4a',
  blocked_drainage: '#2f6f8f',
  water_leakage: '#3b82c4',
  damaged_infrastructure: '#6b5b95',
  broken_streetlight: '#b08800',
  unsafe_pathway: '#1d7568',
  other: '#94a3b8',
};

export const PRIORITY_COLORS = {
  critical: '#b42318',
  high: '#c4570a',
  moderate: '#b58105',
  low: '#2a9180',
};

export const STATUS_COLORS = {
  submitted: '#64748b',
  under_review: '#3b6ea8',
  acknowledged: '#6b5b95',
  in_progress: '#c4570a',
  resolved: '#1d7568',
  reopened: '#b42318',
};

export const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
export const categoryLabel = (c) => CATEGORY_LABELS[c] || c;
export const statusLabel = (s) => STATUS_LABELS[s] || s;

// Backend stores naive UTC timestamps; parse them as UTC.
export function parseDate(v) {
  if (!v) return null;
  const s = typeof v === 'string' && !/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? `${v}Z` : v;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(v, withTime = false) {
  const d = parseDate(v);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(v) {
  const d = parseDate(v);
  if (!d) return '—';
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(v);
}

export const formatDistance = (m) => (m == null ? '—' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
