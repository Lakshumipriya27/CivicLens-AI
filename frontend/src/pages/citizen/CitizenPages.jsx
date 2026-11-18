import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Clock3, FilePlus2, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { ReportAPI } from '../../services/endpoints';
import {
  Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, Select, StatCard,
} from '../../components/common/ui';
import { statusOptions } from '../../components/common/options';
import { ReportsTable } from '../../components/reports/ReportParts';

export function CitizenDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => ReportAPI.mine({ page_size: 100 }), []);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const rows = data.rows;
  const count = (fn) => rows.filter(fn).length;
  const open = count((r) => r.status !== 'resolved');
  return (
    <>
      <PageHeader
        title={`Welcome, ${user.full_name.split(' ')[0]}`}
        description="Track the issues you have reported and see how the city is handling them."
        actions={<Link to="/app/report/new"><Button icon={FilePlus2}>Report an issue</Button></Link>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reports submitted" value={data.total} icon={ClipboardList} />
        <StatCard label="Open" value={open} icon={Clock3} />
        <StatCard label="In progress" value={count((r) => r.status === 'in_progress')} icon={Wrench} />
        <StatCard label="Resolved" value={count((r) => r.status === 'resolved')} icon={CheckCircle2} tone="good" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card title="Recent reports" pad={false} actions={rows.length > 0 && <Link to="/app/reports" className="text-[13px] font-medium text-brand-700">View all</Link>}>
          {rows.length ? (
            <ReportsTable rows={rows.slice(0, 6)} linkBase="/app/reports" />
          ) : (
            <EmptyState title="You have not reported anything yet"
              description="When you spot a pothole, overflowing bin, blocked drain or broken streetlight, report it here."
              action={<Link to="/app/report/new"><Button icon={FilePlus2}>Report your first issue</Button></Link>} />
          )}
        </Card>
        <Card title="What happens after you report">
          <ol className="space-y-4 text-[13px] text-ink-700">
            {[
              ['Submitted', 'Your report is saved with a unique ID and your photo.'],
              ['Matched', 'The system looks for other reports about the same problem nearby.'],
              ['Reviewed', 'An administrator confirms matches and groups them into one incident.'],
              ['Prioritised', 'The incident gets a transparent priority score.'],
              ['Resolved', 'You see every status change and the resolution note or photo.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600">{i + 1}</span>
                <span><span className="font-medium text-ink-900">{t}.</span> {d}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

export function MyReports() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { data, loading, error, reload } = useAsync(() => ReportAPI.mine({ status, page, page_size: pageSize }), [status, page]);
  return (
    <>
      <PageHeader title="My reports" description="Every issue you have reported, with its current status."
        actions={<Link to="/app/report/new"><Button icon={FilePlus2}>New report</Button></Link>} />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-3">
          <Select className="w-48" options={statusOptions} placeholder="All statuses" value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
          {data && <span className="text-[13px] text-ink-500">{data.total} report{data.total === 1 ? '' : 's'}</span>}
        </div>
        {loading ? <PageLoader /> : error ? <div className="p-4"><ErrorState message={error} onRetry={reload} /></div> : (
          <>
            <ReportsTable rows={data.rows} linkBase="/app/reports"
              emptyTitle={status ? 'No reports with this status' : 'No reports yet'}
              emptyAction={!status && <Link to="/app/report/new"><Button icon={FilePlus2}>Report an issue</Button></Link>} />
            <Pagination page={page} pageSize={pageSize} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
