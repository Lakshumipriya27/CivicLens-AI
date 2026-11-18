import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { AdminAPI, IncidentAPI } from '../../services/endpoints';
import { errorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  AuthImage, Button, Card, DemoTag, ErrorState, Field, ImageLightbox, Input, KeyValue, Modal, Notice, PageHeader,
  PageLoader, Select, SeverityBadge, StatusBadge, Textarea,
} from '../../components/common/ui';
import { categoryOptions } from '../../components/common/options';
import { PriorityBreakdown, StatusTimeline } from '../../components/reports/ReportParts';
import { CivicMap } from '../../components/map/CivicMap';
import { STATUS_LABELS, STATUS_TRANSITIONS, categoryLabel, formatDate, timeAgo } from '../../utils/format';

function StatusForm({ incident, onSaved }) {
  const toast = useToast();
  const options = (STATUS_TRANSITIONS[incident.status] || []).map((s) => ({ value: s, label: STATUS_LABELS[s] }));
  const [status, setStatus] = useState(options[0]?.value || '');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const resolving = status === 'resolved';

  const save = async (e) => {
    e.preventDefault();
    if (resolving && !note.trim() && !file) return toast.error('Add a resolution note or evidence photo.');
    if (file && file.size > 8 * 1024 * 1024) return toast.error('Evidence photo must be under 8 MB.');
    setBusy(true);
    try {
      await IncidentAPI.setStatus(incident.id, status, note.trim(), file);
      toast.success(`Status changed to ${STATUS_LABELS[status]}. Linked citizens can see the update.`);
      setNote('');
      setFile(null);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!options.length) return null;
  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Move to">
        <Select options={options} value={status} onChange={(e) => setStatus(e.target.value)} />
      </Field>
      <Field label={resolving ? 'Resolution note (visible to citizens)' : 'Public note (optional, visible to citizens)'}>
        <Textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {(resolving || status === 'in_progress') && (
        <Field label="Evidence photo (optional)" help="JPEG, PNG or WEBP up to 8 MB.">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink-300 px-3 py-2 text-[13px] text-ink-600 hover:bg-ink-50">
            <ImagePlus className="h-4 w-4" />
            {file ? file.name : 'Choose a photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </Field>
      )}
      <Button type="submit" loading={busy} className="w-full">Update status</Button>
    </form>
  );
}

function EditIncidentModal({ incident, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    category: incident.category, description: incident.description, address: incident.address || '',
    exposure: incident.exposure_override ?? '',
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = { category: form.category, description: form.description.trim(), address: form.address };
      if (form.exposure === '' || form.exposure === null) body.clear_exposure_override = true;
      else body.exposure_override = Number(form.exposure);
      onSaved(await IncidentAPI.update(incident.id, body));
      toast.success('Incident updated and priority recalculated.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Edit incident"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Category"><Select options={categoryOptions} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Address / landmark"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Public exposure override (0–100)" help="Leave empty to use the automatic estimate (category baseline + context keywords).">
          <Input type="number" min="0" max="100" value={form.exposure} onChange={(e) => setForm({ ...form, exposure: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function AddReportsModal({ incident, onClose, onDone }) {
  const toast = useToast();
  const { data, loading } = useAsync(() => AdminAPI.reports({ grouped: false, category: incident.category, page_size: 50 }), []);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const save = async () => {
    setBusy(true);
    try {
      await IncidentAPI.group(incident.id, selected, 'Grouped by administrator.');
      toast.success(`${selected.length} report(s) linked.`);
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Link more reports" width="max-w-2xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!selected.length} onClick={save}>Link {selected.length || ''} report(s)</Button></>}>
      <p className="mb-3 text-[13px] text-ink-600">Ungrouped reports in “{categoryLabel(incident.category)}”. Only link reports you have verified describe the same problem.</p>
      {loading ? <PageLoader /> : !data?.rows?.length ? <p className="py-6 text-center text-[13px] text-ink-500">No ungrouped reports in this category.</p> : (
        <div className="divide-y divide-ink-100">
          {data.rows.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-3 py-2.5">
              <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
              <AuthImage src={r.image_url} alt="" className="h-10 w-12 shrink-0 rounded border border-ink-200" />
              <div className="min-w-0">
                <p className="font-medium">{r.report_code} <span className="text-[12px] font-normal text-ink-500">· {timeAgo(r.created_at)}</span></p>
                <p className="truncate text-[12px] text-ink-500">{r.address ? `${r.address} — ` : ''}{r.description}</p>
              </div>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function IncidentDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data: inc, loading, error, reload, setData } = useAsync(() => IncidentAPI.get(id), [id]);
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const addNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      const n = await IncidentAPI.addNote(inc.id, note.trim());
      setData((d) => ({ ...d, notes: [n, ...d.notes] }));
      setNote('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  const refreshPriority = async () => {
    setRefreshing(true);
    try {
      const p = await IncidentAPI.priority(inc.id);
      setData((d) => ({ ...d, priority_breakdown: p, priority_score: p.score, priority_level: p.level }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <PageHeader
        back={<Link to="/admin/incidents" className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-500 hover:text-ink-800"><ArrowLeft className="h-3.5 w-3.5" /> Incidents</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{inc.incident_code} <StatusBadge status={inc.status} /></span>}
        description={`${categoryLabel(inc.category)} · ${inc.supporting_report_count} linked report(s) · created ${formatDate(inc.created_at)}`}
        actions={(
          <>
            <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>Edit</Button>
            {inc.status !== 'resolved' && <Button variant="secondary" icon={Plus} onClick={() => setModal('add')}>Link reports</Button>}
          </>
        )}
      />
      {inc.is_demo && <div className="mb-4"><DemoTag /></div>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <dl className="divide-y divide-ink-100">
              <KeyValue label="Description">{inc.description}</KeyValue>
              <KeyValue label="Severity"><SeverityBadge severity={inc.severity} /></KeyValue>
              <KeyValue label="Location">{inc.address || '—'}<p className="text-[12px] text-ink-500">{inc.latitude.toFixed(5)}, {inc.longitude.toFixed(5)} (centre of linked reports)</p></KeyValue>
              {inc.resolution_note && <KeyValue label="Resolution">{inc.resolution_note}</KeyValue>}
            </dl>
            {inc.resolution_image_url && (
              <div className="mt-3">
                <p className="mb-1 text-[12px] text-ink-500">Resolution evidence</p>
                <AuthImage src={inc.resolution_image_url} alt="Resolution evidence" onClick={setLightbox} className="h-40 w-56 rounded-md border border-ink-200" />
              </div>
            )}
          </Card>

          <Card title={`Linked reports (${inc.reports.length})`} subtitle="Each citizen keeps their own report record.">
            <div className="grid gap-4 sm:grid-cols-2">
              {inc.reports.map((r) => (
                <div key={r.id} className="overflow-hidden rounded-md border border-ink-200">
                  <AuthImage src={r.image_url} alt="" onClick={setLightbox} className="aspect-[4/3] w-full" />
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/admin/reports/${r.id}`} className="font-medium hover:text-brand-700">{r.report_code}</Link>
                      <span className="text-[12px] text-ink-500">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] text-ink-700">{r.description}</p>
                    <p className="mt-1 text-[12px] text-ink-500">{r.reporter?.full_name} · {r.severity} severity</p>
                    {r.analysis && (
                      <p className="mt-1 text-[12px] text-ink-500">
                        {r.analysis.is_simulated ? 'Simulated' : 'AI'}: {r.analysis.category_label}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Location" pad={false}>
            <div className="p-3"><CivicMap incidents={[inc]} reports={inc.reports.map((r) => ({ ...r, short_description: r.description }))} height={300}
              linkFor={(t, i) => (t === 'report' ? `/admin/reports/${i.id}` : null)} /></div>
          </Card>

          <Card title="History"><StatusTimeline history={inc.history} /></Card>
        </div>

        <div className="space-y-6">
          <Card title="Priority" actions={<Button size="sm" variant="ghost" icon={RefreshCw} loading={refreshing} onClick={refreshPriority}>Recalculate</Button>}>
            <PriorityBreakdown breakdown={inc.priority_breakdown} />
          </Card>
          <Card title="Update status">
            {inc.status === 'resolved' && <div className="mb-3"><Notice tone="success">Resolved {formatDate(inc.resolved_at, true)}. You can reopen it if the problem returns.</Notice></div>}
            <StatusForm key={inc.status} incident={inc} onSaved={() => reload(true)} />
          </Card>
          <Card title="Internal notes" subtitle="Visible to administrators only.">
            <form onSubmit={addNote} className="space-y-2">
              <Textarea rows={3} maxLength={2000} placeholder="Add a note for the team…" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" size="sm" loading={savingNote} disabled={!note.trim()}>Add note</Button>
            </form>
            <ul className="mt-4 space-y-3">
              {inc.notes.map((n) => (
                <li key={n.id} className="rounded-md bg-ink-50 px-3 py-2">
                  <p className="text-[13px] text-ink-800">{n.note}</p>
                  <p className="mt-1 text-[11px] text-ink-500">{n.admin} · {formatDate(n.created_at, true)}</p>
                </li>
              ))}
              {!inc.notes.length && <li className="text-[13px] text-ink-500">No notes yet.</li>}
            </ul>
          </Card>
        </div>
      </div>

      {modal === 'edit' && <EditIncidentModal incident={inc} onClose={() => setModal(null)} onSaved={() => reload(true)} />}
      {modal === 'add' && <AddReportsModal incident={inc} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(true); }} />}
      <ImageLightbox url={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
