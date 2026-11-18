import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Layers, Pencil, RefreshCw, X } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { AIAPI, DuplicateAPI, IncidentAPI, ReportAPI } from '../../services/endpoints';
import { errorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  AuthImage, Button, Card, ConfirmDialog, DemoTag, ErrorState, Field, ImageLightbox, Input, KeyValue, Modal,
  Notice, PageHeader, PageLoader, PriorityBadge, Select, SeverityBadge, StatusBadge, Textarea,
} from '../../components/common/ui';
import { categoryOptions, severityOptions, statusOptions } from '../../components/common/options';
import { AnalysisPanel, SignalBars, StatusTimeline } from '../../components/reports/ReportParts';
import { CivicMap } from '../../components/map/CivicMap';
import { categoryLabel, formatDate, formatDistance } from '../../utils/format';

function EditReportModal({ report, admin, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    category: report.category, description: report.description, address: report.address || '', severity: report.severity,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = { category: form.category, description: form.description.trim(), address: form.address };
      if (admin) body.severity = form.severity;
      onSaved(await ReportAPI.update(report.id, body));
      toast.success('Report updated.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Edit report"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save changes</Button></>}>
      <div className="space-y-4">
        <Field label="Category"><Select options={categoryOptions} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
        {admin && <Field label="Severity"><Select options={severityOptions} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} /></Field>}
        <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Landmark or address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function AddToIncidentModal({ report, onClose, onDone }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const { data, loading } = useAsync(() => IncidentAPI.list({ q, status: 'open', category: q ? '' : report.category, page_size: 10 }), [q]);
  const [busy, setBusy] = useState(null);
  const attach = async (inc) => {
    setBusy(inc.id);
    try {
      await IncidentAPI.group(inc.id, [report.id], `Linked by administrator to ${inc.incident_code}.`);
      toast.success(`Report linked to ${inc.incident_code}.`);
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal open onClose={onClose} title="Link to an existing incident" width="max-w-xl">
      <Input placeholder="Search by incident code or description" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="help">{q ? 'Searching all open incidents.' : `Showing open incidents in “${categoryLabel(report.category)}”.`}</p>
      <div className="mt-3 divide-y divide-ink-100">
        {loading ? <PageLoader /> : data?.rows?.length ? data.rows.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="font-medium">{i.incident_code} <span className="text-[12px] font-normal text-ink-500">· {i.supporting_report_count} report(s)</span></p>
              <p className="truncate text-[12px] text-ink-500">{i.description}</p>
            </div>
            <Button size="sm" variant="secondary" loading={busy === i.id} onClick={() => attach(i)}>Link</Button>
          </div>
        )) : <p className="py-6 text-center text-[13px] text-ink-500">No matching open incidents.</p>}
      </div>
    </Modal>
  );
}

function StatusModal({ report, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(report.status);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await ReportAPI.update(report.id, { status, note: note || undefined }));
      toast.success('Status updated.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Update report status"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={status === report.status} onClick={save}>Update</Button></>}>
      <div className="space-y-4">
        <Notice>For ungrouped reports only. Once linked to an incident, status is managed on the incident.</Notice>
        <Field label="New status"><Select options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} /></Field>
        <Field label="Note visible to the citizen (optional)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export default function ReportDetail({ admin = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: r, loading, error, reload, setData } = useAsync(() => ReportAPI.get(id), [id]);
  const [modal, setModal] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [busy, setBusy] = useState(null);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const canCitizenEdit = !admin && r.status === 'submitted' && !r.incident_id;
  const merge = (updated) => setData((d) => ({ ...d, ...updated }));

  const review = async (sug, decision) => {
    setBusy(`${sug.id}-${decision}`);
    try {
      const res = await DuplicateAPI.review(sug.id, decision);
      toast.success(decision === 'confirm' ? `Grouped into ${res.incident.incident_code}.` : 'Suggestion rejected.');
      reload(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const promote = async () => {
    setBusy('promote');
    try {
      const inc = await IncidentAPI.create({ report_ids: [r.id], note: `Incident created from verified report ${r.report_code}.` });
      toast.success(`Incident ${inc.incident_code} created.`);
      navigate(`/admin/incidents/${inc.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
      setModal(null);
    }
  };

  const reanalyze = async () => {
    setBusy('ai');
    try {
      const a = await AIAPI.reanalyze(r.id);
      merge({ analysis: a });
      toast.success('Analysis refreshed.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const pendingSugs = (r.duplicate_suggestions || []).filter((s) => s.review_status === 'pending');
  const otherSugs = (r.duplicate_suggestions || []).filter((s) => s.review_status !== 'pending');

  return (
    <>
      <PageHeader
        back={<Link to={admin ? '/admin/reports' : '/app/reports'} className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-ink-800"><ArrowLeft className="h-3.5 w-3.5" /> {admin ? 'All reports' : 'My reports'}</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{r.report_code} <StatusBadge status={r.status} /></span>}
        description={`${categoryLabel(r.category)} · submitted ${formatDate(r.created_at, true)}`}
        actions={(
          <>
            {(admin || canCitizenEdit) && <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>Edit</Button>}
            {admin && !r.incident_id && <Button variant="secondary" onClick={() => setModal('status')}>Update status</Button>}
            {admin && !r.incident_id && <Button variant="secondary" icon={Layers} onClick={() => setModal('link')}>Link to incident</Button>}
            {admin && !r.incident_id && <Button onClick={() => setModal('promote')}>Create incident</Button>}
          </>
        )}
      />
      {r.is_demo && <div className="mb-4"><DemoTag /></div>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card pad={false}>
            <div className="grid xl:grid-cols-[1fr_1.1fr]">
              <AuthImage src={r.image_url} alt="Report photo" onClick={setLightbox} className="aspect-[4/3] w-full rounded-t-lg xl:h-full xl:rounded-l-lg xl:rounded-tr-none" />
              <dl className="divide-y divide-ink-100 px-5 py-3">
                <KeyValue label="Category">{categoryLabel(r.category)}</KeyValue>
                <KeyValue label="Severity"><SeverityBadge severity={r.severity} /></KeyValue>
                <KeyValue label="Description">{r.description}</KeyValue>
                <KeyValue label="Location">{r.address || '—'}<p className="text-[12px] text-ink-500">{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</p></KeyValue>
                {admin && <KeyValue label="Reporter">{r.reporter?.full_name}</KeyValue>}
              </dl>
            </div>
          </Card>

          <Card title="AI analysis" actions={admin && r.image_url && (
            <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy === 'ai'} onClick={reanalyze}>Re-run</Button>
          )}>
            <AnalysisPanel analysis={r.analysis} />
          </Card>

          {admin && (
            <Card title="Duplicate suggestions" subtitle="AI-assisted matches. Confirming groups both reports into one incident.">
              {!r.duplicate_suggestions?.length && <p className="text-[13px] text-ink-500">No possible duplicates were detected for this report.</p>}
              <div className="space-y-3">
                {[...pendingSugs, ...otherSugs].map((s) => {
                  const other = s.report.id === r.id ? s.possible_duplicate : s.report;
                  return (
                    <div key={s.id} className="rounded-md border border-ink-200 p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <AuthImage src={other.image_url} alt="" className="h-14 w-16 shrink-0 rounded border border-ink-200" />
                          <div>
                            <Link to={`/admin/reports/${other.id}`} className="font-medium hover:text-brand-700">{other.report_code}</Link>
                            {other.incident_code && <span className="ml-2 text-[12px] text-ink-500">in {other.incident_code}</span>}
                            <p className="text-[12px] text-ink-500">{formatDistance(s.distance_m)} away · match {Math.round(s.similarity_score * 100)}%</p>
                            <p className="mt-1 text-[13px] text-ink-700">{s.explanation}</p>
                          </div>
                        </div>
                        {s.review_status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" icon={X} loading={busy === `${s.id}-reject`} onClick={() => review(s, 'reject')}>Reject</Button>
                            <Button size="sm" icon={Check} loading={busy === `${s.id}-confirm`} onClick={() => review(s, 'confirm')}>Confirm &amp; group</Button>
                          </div>
                        ) : (
                          <span className={`text-[12px] font-medium ${s.review_status === 'confirmed' ? 'text-brand-700' : 'text-ink-500'}`}>
                            {s.review_status === 'confirmed' ? 'Confirmed' : 'Rejected'}
                          </span>
                        )}
                      </div>
                      <div className="mt-3"><SignalBars signals={s.signals?.signals} /></div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {r.incident ? (
            <Card title="Linked incident">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {admin ? <Link to={`/admin/incidents/${r.incident.id}`} className="font-medium text-brand-700">{r.incident.incident_code}</Link>
                    : <span className="font-medium">{r.incident.incident_code}</span>}
                  <StatusBadge status={r.incident.status} />
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-500">Priority</span>
                  <PriorityBadge level={r.incident.priority_level} score={r.incident.priority_score} />
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-500">Reports about this issue</span>
                  <span className="font-medium">{r.incident.supporting_report_count}</span>
                </div>
                {!admin && r.incident.supporting_report_count > 1 && (
                  <p className="text-[12px] text-ink-500">Other citizens reported the same problem. Your report adds weight to its priority.</p>
                )}
                {r.incident.resolution_note && (
                  <div className="rounded-md border border-brand-200 bg-brand-50 p-3">
                    <p className="text-[12px] font-medium text-brand-800">Resolution note</p>
                    <p className="mt-0.5 text-[13px] text-ink-800">{r.incident.resolution_note}</p>
                  </div>
                )}
                {r.incident.resolution_image_url && (
                  <div>
                    <p className="mb-1 text-[12px] text-ink-500">Resolution evidence</p>
                    <AuthImage src={r.incident.resolution_image_url} alt="Resolution evidence" onClick={setLightbox} className="aspect-[4/3] w-full rounded-md border border-ink-200" />
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card title="Incident">
              <p className="text-[13px] text-ink-600">Not yet grouped into an incident. {admin ? 'Review duplicates or create an incident.' : 'An administrator will review it.'}</p>
            </Card>
          )}
          <Card title="Status history"><StatusTimeline history={r.history} /></Card>
          <Card title="Location" pad={false}>
            <div className="p-3"><CivicMap reports={[{ ...r, short_description: r.description }]} height={220} /></div>
          </Card>
        </div>
      </div>

      {modal === 'edit' && <EditReportModal report={r} admin={admin} onClose={() => setModal(null)} onSaved={merge} />}
      {modal === 'status' && <StatusModal report={r} onClose={() => setModal(null)} onSaved={() => reload(true)} />}
      {modal === 'link' && <AddToIncidentModal report={r} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(true); }} />}
      <ConfirmDialog open={modal === 'promote'} title="Create incident from this report"
        message="Use this when the report is verified and no matching incident exists. A new incident with one supporting report will be created."
        confirmLabel="Create incident" loading={busy === 'promote'} onConfirm={promote} onCancel={() => setModal(null)} />
      <ImageLightbox url={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
