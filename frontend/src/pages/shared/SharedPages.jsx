import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { AuthAPI, MapAPI } from '../../services/endpoints';
import { errorMessage } from '../../services/api';
import {
  Button, Card, ErrorState, Field, Input, KeyValue, PageHeader, PageLoader, Select,
} from '../../components/common/ui';
import { categoryOptions, priorityOptions, statusOptions } from '../../components/common/options';
import { CivicMap, MapLegend } from '../../components/map/CivicMap';
import { cap, formatDate } from '../../utils/format';

export function MapPage({ admin = false }) {
  const [filters, setFilters] = useState({ category: '', status: 'open', priority_level: '', include_reports: true });
  const { data, loading, error, reload } = useAsync(() => MapAPI.points(filters), [JSON.stringify(filters)]);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const linkFor = (type, item) => {
    if (admin) return type === 'incident' ? `/admin/incidents/${item.id}` : `/admin/reports/${item.id}`;
    if (type === 'report' && item.is_own) return `/app/reports/${item.id}`;
    return null;
  };

  return (
    <>
      <PageHeader title="City map"
        description={admin ? 'All incidents and ungrouped reports. Click a marker for details.'
          : 'Issues reported across the city. Personal details and photos of other citizens are never shown.'} />
      <Card pad={false}>
        <div className="flex flex-wrap items-end gap-3 border-b border-ink-100 px-4 py-3">
          <Field label="Category" className="w-52"><Select options={categoryOptions} placeholder="All categories" value={filters.category} onChange={set('category')} /></Field>
          <Field label="Status" className="w-44">
            <Select options={[{ value: 'open', label: 'All open' }, ...statusOptions]} placeholder="Any status" value={filters.status} onChange={set('status')} />
          </Field>
          <Field label="Priority" className="w-40"><Select options={priorityOptions} placeholder="Any priority" value={filters.priority_level} onChange={set('priority_level')} /></Field>
          <label className="mb-2 flex items-center gap-2 text-[13px] text-ink-700">
            <input type="checkbox" checked={filters.include_reports} onChange={set('include_reports')} className="h-4 w-4 accent-brand-700" />
            Show ungrouped reports
          </label>
          {data && (
            <span className="mb-2 ml-auto text-[13px] text-ink-500">
              {data.incidents.length} incident{data.incidents.length === 1 ? '' : 's'} · {data.reports.length} ungrouped report{data.reports.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="p-4">
          {loading && !data ? <PageLoader label="Loading map…" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
            <>
              <CivicMap incidents={data.incidents} reports={data.reports} height={560} linkFor={linkFor} />
              <div className="mt-3"><MapLegend /></div>
              {!data.incidents.length && !data.reports.length && (
                <p className="mt-3 text-[13px] text-ink-500">No issues match these filters.</p>
              )}
            </>
          )}
        </div>
      </Card>
    </>
  );
}

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.full_name);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error('Name must be at least 2 characters.');
    setSavingName(true);
    try {
      setUser(await AuthAPI.updateMe({ full_name: name.trim() }));
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const savePw = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.new_password.length < 8 || !/[A-Za-z]/.test(pw.new_password) || !/\d/.test(pw.new_password)) {
      return setPwError('New password needs at least 8 characters, including a letter and a number.');
    }
    if (pw.new_password !== pw.confirm) return setPwError('New passwords do not match.');
    setSavingPw(true);
    try {
      await AuthAPI.changePassword({ current_password: pw.current_password, new_password: pw.new_password });
      setPw({ current_password: '', new_password: '', confirm: '' });
      toast.success('Password changed.');
    } catch (err) {
      setPwError(errorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile" description="Manage your account details." />
      <div className="space-y-6">
        <Card title="Account">
          <dl className="mb-4 divide-y divide-ink-100">
            <KeyValue label="Email">{user.email}</KeyValue>
            <KeyValue label="Role">{cap(user.role)}{user.is_demo && <span className="ml-2 text-[12px] text-ink-500">(fictional demo account)</span>}</KeyValue>
            <KeyValue label="Member since">{formatDate(user.created_at)}</KeyValue>
          </dl>
          <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Full name" htmlFor="name" className="flex-1">
              <Input id="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button type="submit" loading={savingName} disabled={name.trim() === user.full_name}>Save name</Button>
          </form>
        </Card>
        <Card title="Change password">
          <form onSubmit={savePw} className="grid gap-4 sm:grid-cols-3">
            <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
            <Field label="New password"><Input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
            <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
            {pwError && <p className="error-text sm:col-span-3">{pwError}</p>}
            <div className="sm:col-span-3">
              <Button type="submit" loading={savingPw} disabled={!pw.current_password || !pw.new_password}>Change password</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
