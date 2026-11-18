import { api } from './api';

const data = (p) => p.then((r) => r.data);
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));

export const AuthAPI = {
  login: (email, password) => data(api.post('/api/auth/login', { email, password })),
  register: (body) => data(api.post('/api/auth/register', body)),
  me: () => data(api.get('/api/auth/me')),
  updateMe: (body) => data(api.patch('/api/auth/me', body)),
  changePassword: (body) => data(api.post('/api/auth/change-password', body)),
};

export const MetaAPI = {
  meta: () => data(api.get('/api/meta')),
  health: () => data(api.get('/api/health')),
  aiStatus: () => data(api.get('/api/ai/status')),
};

export const AIAPI = {
  analyze: (file, hint) => {
    const fd = new FormData();
    fd.append('image', file);
    if (hint) fd.append('hint', hint);
    return data(api.post('/api/ai/analyze', fd, { timeout: 90000 }));
  },
  reanalyze: (reportId) => data(api.post(`/api/ai/analyze/${reportId}`, null, { timeout: 90000 })),
};

export const ReportAPI = {
  create: (fields, file) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') fd.append(k, v);
    });
    if (file) fd.append('image', file);
    return data(api.post('/api/reports', fd));
  },
  list: (params) => data(api.get('/api/reports', { params: clean(params) })),
  mine: (params) => data(api.get('/api/reports/my-reports', { params: clean(params) })),
  get: (id) => data(api.get(`/api/reports/${id}`)),
  update: (id, body) => data(api.patch(`/api/reports/${id}`, body)),
};

export const DuplicateAPI = {
  check: (body) => data(api.post('/api/duplicates/check', body)),
  list: (params) => data(api.get('/api/duplicates', { params: clean(params) })),
  forReport: (id) => data(api.get(`/api/duplicates/${id}`)),
  review: (id, decision, note) => data(api.post(`/api/duplicates/${id}/review`, { decision, note })),
};

export const IncidentAPI = {
  list: (params) => data(api.get('/api/incidents', { params: clean(params) })),
  get: (id) => data(api.get(`/api/incidents/${id}`)),
  create: (body) => data(api.post('/api/incidents', body)),
  update: (id, body) => data(api.patch(`/api/incidents/${id}`, body)),
  group: (id, reportIds, note) => data(api.post(`/api/incidents/${id}/group`, { report_ids: reportIds, note })),
  setStatus: (id, newStatus, note, evidence) => {
    const fd = new FormData();
    fd.append('new_status', newStatus);
    if (note) fd.append('note', note);
    if (evidence) fd.append('evidence', evidence);
    return data(api.patch(`/api/incidents/${id}/status`, fd));
  },
  addNote: (id, note) => data(api.post(`/api/admin/incidents/${id}/notes`, { note })),
  priority: (id) => data(api.get(`/api/priority/${id}`)),
};

export const PriorityAPI = {
  config: () => data(api.get('/api/priority/config')),
  calculate: (body) => data(api.post('/api/priority/calculate', body)),
};

export const AnalyticsAPI = {
  overview: () => data(api.get('/api/analytics/overview')),
  categories: () => data(api.get('/api/analytics/categories')),
  monthly: (months = 12) => data(api.get('/api/analytics/monthly', { params: { months } })),
  status: () => data(api.get('/api/analytics/status')),
  priority: () => data(api.get('/api/analytics/priority')),
};

export const AdminAPI = {
  dashboard: () => data(api.get('/api/admin/dashboard')),
  reports: (params) => data(api.get('/api/admin/reports', { params: clean(params) })),
};

export const MapAPI = {
  points: (params) => data(api.get('/api/map/incidents', { params: clean(params) })),
};

export const fetchImageBlob = (url) => api.get(url, { responseType: 'blob' }).then((r) => r.data);
