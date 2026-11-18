import { CATEGORY_LABELS, PRIORITY_LEVELS, SEVERITIES, STATUS_LABELS, cap } from '../../utils/format';

export const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
export const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
export const severityOptions = SEVERITIES.map((s) => ({ value: s, label: cap(s) }));
export const priorityOptions = PRIORITY_LEVELS.map((s) => ({ value: s, label: cap(s) }));
