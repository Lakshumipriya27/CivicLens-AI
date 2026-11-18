import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon, CheckCircle2, ClipboardList, Copy, Hourglass, Layers, Search, Wrench, X, Check,
} from 'lucide-react';
import { useAsync, useDebounced } from '../../hooks/useAsync';
import { AdminAPI, AnalyticsAPI, DuplicateAPI, IncidentAPI, MapAPI, PriorityAPI } from '../../services/endpoints';
import { errorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  AuthImage, Button, Card, DemoTag, EmptyState, ErrorState, Field, Input, Notice, PageHeader, PageLoader,
  Pagination, Select, StatCard,
} from '../../components/common/ui';
import { categoryOptions, priorityOptions, severityOptions, statusOptions } from '../../components/common/options';
import { IncidentsTable, ReportsTable, SignalBars } from '../../components/reports/ReportParts';
import { CategoryChart, MonthlyChart, PriorityChart, StatusChart } from '../../components/charts/Charts';
import { CivicMap } from '../../components/map/CivicMap';
import { categoryLabel, formatDate, formatDistance, timeAgo } from '../../utils/format';

/* ================= Dashboard ================= */
export function AdminDashboard() {
  const { data, loading, error, reload } = useAsync(() => AdminAPI.dashboard(), []);
  const mapData = useAsync(() => MapAPI.points({ status: 'open' }), []);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const o = data.overview;
  const empty = o.total_reports === 0;

  return (
    <>
      <PageHeader title="Operations dashboard" description="Live figures calculated from the reports and incidents in the database."
        actions={o.pending_duplicate_suggestions > 0 && (
          <Link to="/admin/duplicates"><Button icon={Copy}>Review {o.pending_duplicate_suggestions} duplicate suggestion{o.pending_duplicate_suggestions === 1 ? '' : 's'}</Button></Link>
        )} />
      {o.demo_records > 0 && (
        <div className="mb-4"><Notice>{o.demo_records} of {o.total_reports} reports are <strong>fictional demonstration records</strong> created by the seed script.</Notice></div>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total reports" value={o.total_reports} icon={ClipboardList} />
        <StatCard label="Incidents" value={o.total_incidents} icon={Layers} hint={`${o.open_incidents} open`} />
        <StatCard label="Pending review" value={o.pending_reviews} icon={Hourglass} hint={`${o.pending_duplicate_suggestions} duplicate suggestion(s)`} />
        <StatCard label="In progress" value={o.in_progress_incidents} icon={Wrench} />
        <StatCard label="Resolved" value={o.resolved_incidents} icon={CheckCircle2} tone="good"
          hint={o.avg_resolution_days != null ? `avg ${o.avg_resolution_days} days` : 'no resolutions yet'} />
        <StatCard label="Critical (open)" value={o.critical_incidents} icon={AlertOctagon} tone={o.critical_incidents ? 'alert' : 'default'} />
      </div>

      {empty ? (
        <Card className="mt-6"><EmptyState title="No reports yet" description="Figures and charts will appear as soon as citizens submit reports." /></Card>
      ) : (
        <>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Card title="Highest-priority open incidents" pad={false} actions={<Link to="/admin/incidents" className="text-[13px] font-medium text-brand-700">All incidents</Link>}>
              <IncidentsTable rows={data.top_incidents} compact />
            </Card>
            <Card title="Open incidents map" pad={false} actions={<Link to="/admin/map" className="text-[13px] font-medium text-brand-700">Full map</Link>}>
              <div className="p-3">
                {mapData.data ? (
                  <CivicMap incidents={mapData.data.incidents} reports={mapData.data.reports} height={300}
                    linkFor={(t, i) => (t === 'incident' ? `/admin/incidents/${i.id}` : `/admin/reports/${i.id}`)} />
                ) : <PageLoader />}
              </div>
            </Card>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            <Card title="Reports by category"><CategoryChart data={data.categories} height={260} /></Card>
            <Card title="Incidents by status"><StatusChart data={data.status.incidents} height={260} /></Card>
            <Card title="Monthly trend" subtitle="Last 6 months" className="lg:col-span-2 2xl:col-span-1"><MonthlyChart data={data.monthly} height={260} /></Card>
          </div>
          <Card className="mt-6" title="Recent reports" pad={false} actions={<Link to="/admin/reports" className="text-[13px] font-medium text-brand-700">All reports</Link>}>
            <ReportsTable rows={data.recent_reports} linkBase="/admin/reports" showReporter />
          </Card>
        </>
      )}
    </>
  );
}

/* ================= All reports ================= */
export function AdminReports() {
  const [f, setF] = useState({ q: '', category: '', severity: '', status: '', grouped: '', date_from: '', date_to: '' });
  const [page, setPage] = useState(1);
  const q = useDebounced(f.q, 350);
  const params = { ...f, q, page, page_size: 20 };
  const { data, loading, error, reload } = useAsync(() => AdminAPI.reports(params), [JSON.stringify(params)]);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  const anyFilter = Object.values(f).some(Boolean);

  return (
    <>
      <PageHeader title="All reports" description="Every citizen report. Filter, open a report to review its AI analysis and duplicates." />
      <Card pad={false}>
        <div className="grid gap-3 border-b border-ink-100 px-4 py-3 sm:grid-cols-2 lg:grid-cols-7">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
            <Input className="pl-9" placeholder="Search code, description, address" value={f.q} onChange={set('q')} />
          </div>
          <Select options={categoryOptions} placeholder="All categories" value={f.category} onChange={set('category')} />
          <Select options={severityOptions} placeholder="Any severity" value={f.severity} onChange={set('severity')} />
          <Select options={statusOptions} placeholder="Any status" value={f.status} onChange={set('status')} />
          <Select options={[{ value: 'false', label: 'Not grouped' }, { value: 'true', label: 'Grouped' }]} placeholder="Grouped or not" value={f.grouped} onChange={set('grouped')} />
          <div className="flex gap-2">
            <Input type="date" aria-label="From date" value={f.date_from} onChange={set('date_from')} />
            <Input type="date" aria-label="To date" value={f.date_to} onChange={set('date_to')} />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2 text-[13px] text-ink-500">
          <span>{data ? `${data.total} report${data.total === 1 ? '' : 's'}` : ' '}</span>
          {anyFilter && <button className="font-medium text-brand-700" onClick={() => { setF({ q: '', category: '', severity: '', status: '', grouped: '', date_from: '', date_to: '' }); setPage(1); }}>Clear filters</button>}
        </div>
        {loading && !data ? <PageLoader /> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : (
          <>
            <ReportsTable rows={data.rows} linkBase="/admin/reports" showReporter />
            <Pagination page={page} pageSize={20} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}

/* ================= Duplicate review ================= */
function ReportSide({ r, label }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <div className="flex gap-3">
        <AuthImage src={r.image_url} alt="" className="h-20 w-24 shrink-0 rounded-md border border-ink-200" />
        <div className="min-w-0">
          <Link to={`/admin/reports/${r.id}`} className="font-medium hover:text-brand-700">{r.report_code}</Link>
          <p className="text-[12px] text-ink-500">{categoryLabel(r.category)} · {timeAgo(r.created_at)}</p>
          <p className="mt-1 line-clamp-2 text-[13px] text-ink-700">{r.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {r.incident_code ? <span className="text-[12px] text-ink-600">In {r.incident_code}</span> : <span className="text-[12px] text-ink-400">Not grouped</span>}
            {r.is_demo && <DemoTag label="Demo" />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DuplicateReview() {
  const toast = useToast();
  const [tab, setTab] = useState('pending');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => DuplicateAPI.list({ review_status: tab, page, page_size: 20 }), [tab, page]);
  const [busy, setBusy] = useState(null);

  const review = async (s, decision) => {
    setBusy(`${s.id}-${decision}`);
    try {
      const res = await DuplicateAPI.review(s.id, decision);
      toast.success(decision === 'confirm' ? `Reports grouped into ${res.incident.incident_code}.` : 'Suggestion rejected; reports stay separate.');
      reload(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Duplicate review"
        description="Pairs of reports that may describe the same real-world problem. Nothing is grouped until you confirm." />
      <div className="mb-4 flex gap-1 border-b border-ink-200">
        {['pending', 'confirmed', 'rejected'].map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`-mb-px border-b-2 px-3 py-2 text-[14px] capitalize ${tab === t ? 'border-brand-600 font-medium text-ink-950' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>
            {t}
          </button>
        ))}
      </div>
      {loading && !data ? <PageLoader /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.rows.length ? (
        <Card><EmptyState icon={Copy} title={tab === 'pending' ? 'No suggestions waiting for review' : `No ${tab} suggestions`}
          description={tab === 'pending' ? 'New suggestions appear automatically when citizens submit similar nearby reports.' : undefined} /></Card>
      ) : (
        <div className="space-y-4">
          {data.rows.map((s) => (
            <Card key={s.id} pad={false}>
              <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <ReportSide r={s.report} label="New report" />
                <div className="flex shrink-0 flex-col items-center gap-1 px-2 text-center lg:w-44">
                  <span className="text-[24px] font-semibold tabular-nums">{Math.round(s.similarity_score * 100)}%</span>
                  <span className="text-[12px] text-ink-500">match score · {formatDistance(s.distance_m)}</span>
                </div>
                <ReportSide r={s.possible_duplicate} label="Possible duplicate of" />
              </div>
              <div className="flex flex-col gap-3 border-t border-ink-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[13px] text-ink-700">{s.explanation}</p>
                  <div className="max-w-md"><SignalBars signals={s.signals?.signals} /></div>
                </div>
                {s.review_status === 'pending' ? (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" icon={X} loading={busy === `${s.id}-reject`} onClick={() => review(s, 'reject')}>Not the same</Button>
                    <Button icon={Check} loading={busy === `${s.id}-confirm`} onClick={() => review(s, 'confirm')}>Confirm &amp; group</Button>
                  </div>
                ) : (
                  <span className="text-[13px] text-ink-500">{s.review_status === 'confirmed' ? 'Confirmed' : 'Rejected'} {s.reviewed_at && `· ${formatDate(s.reviewed_at, true)}`}</span>
                )}
              </div>
            </Card>
          ))}
          <Pagination page={page} pageSize={20} total={data.total} onChange={setPage} />
        </div>
      )}
    </>
  );
}

/* ================= Incidents ================= */
export function AdminIncidents() {
  const [f, setF] = useState({ q: '', category: '', status: '', priority_level: '', sort: 'priority' });
  const [page, setPage] = useState(1);
  const q = useDebounced(f.q, 350);
  const params = { ...f, q, page, page_size: 20 };
  const { data, loading, error, reload } = useAsync(() => IncidentAPI.list(params), [JSON.stringify(params)]);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  return (
    <>
      <PageHeader title="Incidents" description="Each incident groups one or more reports about the same real-world problem." />
      <Card pad={false}>
        <div className="grid gap-3 border-b border-ink-100 px-4 py-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
            <Input className="pl-9" placeholder="Search incidents" value={f.q} onChange={set('q')} />
          </div>
          <Select options={categoryOptions} placeholder="All categories" value={f.category} onChange={set('category')} />
          <Select options={[{ value: 'open', label: 'All open' }, ...statusOptions]} placeholder="Any status" value={f.status} onChange={set('status')} />
          <Select options={priorityOptions} placeholder="Any priority" value={f.priority_level} onChange={set('priority_level')} />
          <Select options={[{ value: 'priority', label: 'Sort: highest priority' }, { value: 'newest', label: 'Sort: newest' }, { value: 'updated', label: 'Sort: recently updated' }]}
            value={f.sort} onChange={set('sort')} />
        </div>
        {loading && !data ? <PageLoader /> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : (
          <>
            <IncidentsTable rows={data.rows} />
            <Pagination page={page} pageSize={20} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}

/* ================= Analytics ================= */
function WhatIf() {
  const [v, setV] = useState({ severity: 80, reports: 70, exposure: 90, waiting: 50 });
  const { data } = useAsync(() => PriorityAPI.calculate(v), [JSON.stringify(v)]);
  const labels = { severity: 'Severity (S)', reports: 'Corroborating reports (R)', exposure: 'Public exposure (V)', waiting: 'Waiting time (W)' };
  return (
    <Card title="Priority calculator" subtitle="Try factor values against the configured weights.">
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {Object.keys(labels).map((k) => (
            <Field key={k} label={<span className="flex justify-between"><span>{labels[k]}</span><span className="tabular-nums text-ink-500">{v[k]}</span></span>}>
              <input type="range" min="0" max="100" value={v[k]} className="w-full accent-brand-700"
                onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
            </Field>
          ))}
        </div>
        <div className="rounded-md border border-ink-200 bg-ink-50 p-4">
          {data ? (
            <>
              <p className="text-[12px] text-ink-500">Result</p>
              <p className="text-[32px] font-semibold tabular-nums">{data.score.toFixed(1)}</p>
              <p className="font-medium capitalize">{data.level}</p>
              <p className="mt-3 font-mono text-[12px] text-ink-600">{data.formula}</p>
              <p className="mt-3 text-[12px] text-ink-500">{data.disclaimer}</p>
            </>
          ) : <PageLoader />}
        </div>
      </div>
    </Card>
  );
}

export function Analytics() {
  const ov = useAsync(() => AnalyticsAPI.overview(), []);
  const cats = useAsync(() => AnalyticsAPI.categories(), []);
  const monthly = useAsync(() => AnalyticsAPI.monthly(12), []);
  const status = useAsync(() => AnalyticsAPI.status(), []);
  const prio = useAsync(() => AnalyticsAPI.priority(), []);
  if (ov.loading) return <PageLoader />;
  if (ov.error) return <ErrorState message={ov.error} onRetry={ov.reload} />;
  const o = ov.data;
  const resolutionRate = o.total_incidents ? Math.round((o.resolved_incidents / o.total_incidents) * 100) : null;
  const dedupRatio = o.total_incidents ? (o.total_reports / Math.max(1, o.total_incidents)).toFixed(2) : null;

  return (
    <>
      <PageHeader title="Analytics" description="Calculated directly from database records. Includes fictional demonstration data when seeded." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reports" value={o.total_reports} />
        <StatCard label="Incidents" value={o.total_incidents} hint={dedupRatio ? `${dedupRatio} reports per incident (incl. ungrouped)` : undefined} />
        <StatCard label="Resolution rate" value={resolutionRate != null ? `${resolutionRate}%` : '—'} hint="Resolved ÷ all incidents" />
        <StatCard label="Avg. time to resolve" value={o.avg_resolution_days != null ? `${o.avg_resolution_days} d` : '—'} hint="Incident created → resolved" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Monthly reports and resolutions" subtitle="Last 12 months">{monthly.data ? <MonthlyChart data={monthly.data} /> : <PageLoader />}</Card>
        <Card title="Reports by category">{cats.data ? <CategoryChart data={cats.data} /> : <PageLoader />}</Card>
        <Card title="Incidents by status">{status.data ? <StatusChart data={status.data.incidents} /> : <PageLoader />}</Card>
        <Card title="Open incidents by priority level">{prio.data ? <PriorityChart data={prio.data} height={260} /> : <PageLoader />}</Card>
      </div>
      {cats.data?.length > 0 && (
        <Card className="mt-6" title="Category breakdown" pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead><tr><th className="table-th">Category</th><th className="table-th text-right">Reports</th><th className="table-th text-right">Incidents</th></tr></thead>
              <tbody>
                {cats.data.map((c) => (
                  <tr key={c.category}><td className="table-td">{c.label}</td><td className="table-td text-right tabular-nums">{c.reports}</td><td className="table-td text-right tabular-nums">{c.incidents}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <div className="mt-6"><WhatIf /></div>
    </>
  );
}
