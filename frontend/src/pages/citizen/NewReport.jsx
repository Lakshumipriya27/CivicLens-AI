import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Copy, Crosshair, ImagePlus, Loader2, MapPin, ScanSearch,
} from 'lucide-react';
import { AIAPI, DuplicateAPI, ReportAPI } from '../../services/endpoints';
import { errorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Textarea,
} from '../../components/common/ui';
import { categoryOptions, severityOptions } from '../../components/common/options';
import { AnalysisPanel, CandidateCard } from '../../components/reports/ReportParts';
import { LocationPicker } from '../../components/map/CivicMap';
import { useAIStatus } from '../../components/layout/Layouts';

const STEPS = ['Photo', 'AI analysis', 'Details & location', 'Similar reports', 'Done'];
const MAX_MB = 8;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function Stepper({ step }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px]">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[12px] font-semibold ${
            i < step ? 'border-brand-600 bg-brand-600 text-white' : i === step ? 'border-brand-600 text-brand-700' : 'border-ink-300 text-ink-400'}`}>
            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={i === step ? 'font-medium text-ink-900' : 'text-ink-500'}>{s}</span>
          {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-ink-200 sm:block" />}
        </li>
      ))}
    </ol>
  );
}

export default function NewReport() {
  const toast = useToast();
  const navigate = useNavigate();
  const aiStatus = useAIStatus();
  const fileInput = useRef(null);

  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [hint, setHint] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [aiError, setAiError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ category: '', severity: 'medium', description: '', address: '' });
  const [location, setLocation] = useState(null);
  const [geoState, setGeoState] = useState({ busy: false, error: '' });
  const [errors, setErrors] = useState({});
  const [candidates, setCandidates] = useState(null);
  const [created, setCreated] = useState(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const pickFile = (f) => {
    if (!f) return;
    if (!TYPES.includes(f.type)) return toast.error('Please choose a JPEG, PNG or WEBP image.');
    if (f.size > MAX_MB * 1024 * 1024) return toast.error(`The image must be smaller than ${MAX_MB} MB.`);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setAnalysis(null);
    setAiError('');
  };

  const runAnalysis = async () => {
    setBusy(true);
    setAiError('');
    try {
      const a = await AIAPI.analyze(file, hint.trim());
      setAnalysis(a);
      setStep(1);
    } catch (e) {
      setAiError(errorMessage(e, 'Image analysis failed.'));
    } finally {
      setBusy(false);
    }
  };

  const applySuggestions = () => {
    if (analysis) {
      setForm((f) => ({
        ...f,
        category: analysis.detected_category,
        severity: analysis.suggested_severity,
        description: f.description || [hint.trim(), analysis.suggested_description].filter(Boolean).join(' — '),
      }));
    }
    setStep(2);
  };

  const continueManually = () => {
    setAnalysis(null);
    setForm((f) => ({ ...f, description: f.description || hint.trim() }));
    setStep(2);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoState({ busy: false, error: 'Your browser does not support location access. Click the map instead.' });
      return;
    }
    setGeoState({ busy: true, error: '' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoState({ busy: false, error: '' });
      },
      (err) => setGeoState({
        busy: false,
        error: err.code === 1 ? 'Location permission was denied. Click on the map to place the pin instead.' : 'Could not get your location. Click on the map instead.',
      }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const validateDetails = () => {
    const e = {};
    if (!form.category) e.category = 'Choose a category.';
    if (form.description.trim().length < 5) e.description = 'Describe the issue in a few words (at least 5 characters).';
    if (!location) e.location = 'Set the location by clicking the map or using your current location.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const checkDuplicates = async () => {
    if (!validateDetails()) return;
    setBusy(true);
    try {
      const res = await DuplicateAPI.check({ ...location, category: form.category, description: form.description, analysis_id: analysis?.id });
      setCandidates(res.candidates);
      setStep(3);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await ReportAPI.create(
        { ...form, description: form.description.trim(), latitude: location.latitude, longitude: location.longitude, analysis_id: analysis?.id },
        analysis ? null : file,
      );
      setCreated(r);
      setStep(4);
      toast.success(`Report ${r.report_code} submitted.`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0); setFile(null); setPreview(null); setHint(''); setAnalysis(null); setAiError('');
    setForm({ category: '', severity: 'medium', description: '', address: '' }); setLocation(null);
    setCandidates(null); setCreated(null); setErrors({});
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Report a civic issue" description="Upload a photo, review the AI suggestion, confirm the location and submit." />
      <Stepper step={step} />

      {step === 0 && (
        <Card title="1. Add a photograph" subtitle="One clear photo of the problem. Avoid faces and vehicle number plates.">
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <div>
              <input ref={fileInput} type="file" accept={TYPES.join(',')} className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])} />
              {preview ? (
                <div className="space-y-3">
                  <img src={preview} alt="Selected" className="aspect-[4/3] w-full rounded-md border border-ink-200 object-cover" />
                  <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => fileInput.current?.click()}>Choose a different photo</Button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-ink-300 bg-ink-50 text-ink-600 hover:border-brand-400 hover:bg-brand-50/40">
                  <Camera className="h-6 w-6 text-ink-400" />
                  <span className="font-medium">Click to choose a photo</span>
                  <span className="text-[12px] text-ink-500">or drag it here · JPEG, PNG, WEBP · up to {MAX_MB} MB</span>
                </button>
              )}
            </div>
            <div className="space-y-4">
              <Field label="Short note (optional)" htmlFor="hint" help="Helps the analysis, e.g. “pothole near the school gate”.">
                <Textarea id="hint" rows={3} maxLength={500} value={hint} onChange={(e) => setHint(e.target.value)} />
              </Field>
              {aiStatus?.is_simulated && (
                <Notice tone="warn">Demonstration mode: the analysis will be <strong>simulated</strong> (no external AI model is configured).</Notice>
              )}
              {aiError && (
                <Notice tone="error" icon={AlertTriangle} title="Image analysis is unavailable">
                  <p>{aiError}</p>
                  <p className="mt-1">You can retry, or continue and choose the category yourself. Your report will not show any AI result.</p>
                </Notice>
              )}
              <div className="flex flex-wrap gap-2">
                <Button icon={ScanSearch} disabled={!file} loading={busy} onClick={runAnalysis}>
                  {aiError ? 'Retry analysis' : 'Analyse photo'}
                </Button>
                {aiError && <Button variant="secondary" onClick={continueManually}>Continue without AI</Button>}
              </div>
              {busy && <p className="flex items-center gap-2 text-[13px] text-ink-500"><Loader2 className="h-4 w-4 animate-spin" /> Analysing image…</p>}
            </div>
          </div>
        </Card>
      )}

      {step === 1 && analysis && (
        <Card title="2. AI analysis result" subtitle="Review the suggestion. You can edit everything in the next step.">
          <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
            <img src={preview} alt="Uploaded" className="aspect-[4/3] w-full rounded-md border border-ink-200 object-cover" />
            <AnalysisPanel analysis={analysis} compact />
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-ink-100 pt-4">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(0)}>Change photo</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={continueManually}>Ignore suggestions</Button>
              <Button onClick={applySuggestions}>Use suggestions <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title="3. Details and location">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              {analysis && (
                <Notice>
                  Prefilled from the {analysis.is_simulated ? 'simulated' : 'AI'} analysis
                  ({analysis.category_label}). Change anything that is not right.
                </Notice>
              )}
              <Field label="Category" htmlFor="category" error={errors.category}>
                <Select id="category" options={categoryOptions} placeholder="Select a category" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </Field>
              <Field label="How serious is it?" htmlFor="severity">
                <Select id="severity" options={severityOptions} value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })} />
              </Field>
              <Field label="Description" htmlFor="description" error={errors.description}>
                <Textarea id="description" maxLength={2000} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Field label="Landmark or address (optional)" htmlFor="address">
                <Input id="address" maxLength={255} value={form.address} placeholder="e.g. Opposite the bus stop on Main Road"
                  onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="label mb-0">Location</span>
                <Button variant="secondary" size="sm" icon={Crosshair} loading={geoState.busy} onClick={useMyLocation}>Use my current location</Button>
              </div>
              <LocationPicker value={location} onChange={setLocation} height={300} />
              <p className="text-[12px] text-ink-500">
                {location ? (
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} · drag the pin to adjust</span>
                ) : 'Click the map to drop a pin. Your location is only read if you press “Use my current location”.'}
              </p>
              {geoState.error && <p className="error-text">{geoState.error}</p>}
              {errors.location && <p className="error-text">{errors.location}</p>}
            </div>
          </div>
          <div className="mt-6 flex justify-between gap-2 border-t border-ink-100 pt-4">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(analysis ? 1 : 0)}>Back</Button>
            <Button loading={busy} onClick={checkDuplicates}>Check for similar reports <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card title="4. Similar reports nearby" subtitle="Possible matches found by comparing location, category, wording, timing and photos.">
          {candidates?.length ? (
            <div className="space-y-3">
              <Notice icon={Copy}>
                {candidates.length} report{candidates.length > 1 ? 's' : ''} nearby may describe the same issue. Submitting still records
                your report individually — it adds weight to the incident and an administrator decides whether to group them.
              </Notice>
              {candidates.map((c) => <CandidateCard key={c.report_code} c={c} />)}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="No similar reports found nearby" description="Your report looks like the first one for this issue in the area." />
          )}
          <div className="mt-6 flex justify-between gap-2 border-t border-ink-100 pt-4">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(2)}>Edit details</Button>
            <Button loading={busy} onClick={submit}>Submit report</Button>
          </div>
        </Card>
      )}

      {step === 4 && created && (
        <Card>
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-brand-600" />
            <h2 className="mt-3 text-[20px] font-semibold">Report submitted</h2>
            <p className="mt-1 text-ink-600">Your report ID is</p>
            <p className="mt-1 rounded-md border border-ink-200 bg-ink-50 px-3 py-1.5 font-mono text-[18px] font-semibold">{created.report_code}</p>
            {created.duplicate_suggestion_count > 0 && (
              <p className="mt-3 max-w-md text-[13px] text-ink-600">
                It was flagged as a possible match for {created.duplicate_suggestion_count} existing report(s). An administrator will review this.
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button onClick={() => navigate(`/app/reports/${created.id}`)}>Track this report</Button>
              <Button variant="secondary" onClick={reset}>Report another issue</Button>
            </div>
            <Link to="/app/reports" className="mt-4 text-[13px] text-brand-700">View all my reports</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
