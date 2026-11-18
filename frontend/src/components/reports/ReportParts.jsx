import { Link } from 'react-router-dom';
import { Bot, FlaskConical, Info, ShieldAlert } from 'lucide-react';
import {
  AuthImage, CategoryTag, DemoTag, EmptyState, Notice, PriorityBadge, SeverityBadge, StatusBadge,
} from '../common/ui';
import {
  PRIORITY_COLORS, STATUS_COLORS, cap, categoryLabel, formatDate, formatDistance, pct, timeAgo,
} from '../../utils/format';

/* ---------------- AI analysis ---------------- */
export function AnalysisPanel({ analysis, compact = false }) {
  if (!analysis) {
    return <p className="text-[13px] text-ink-500">No AI analysis is stored for this report.</p>;
  }
  const sim = analysis.is_simulated;
  return (
    <div className="space-y-4">
      {sim ? (
        <Notice tone="warn" icon={FlaskConical} title="Simulated analysis (demonstration mode)">
          Produced by simple image statistics and keywords — not by an AI vision model. Treat it as a placeholder suggestion.
        </Notice>
      ) : (
        <Notice tone="info" icon={Bot} title={`AI suggestion · ${analysis.provider}${analysis.model_name ? ` (${analysis.model_name})` : ''}`}>
          Generated from the photograph only. It is not a verification of the real-world incident and requires human review.
        </Notice>
      )}
      {!analysis.is_civic_issue && (
        <Notice tone="error" icon={ShieldAlert} title="No clear civic issue detected">
          The analysis could not identify a public infrastructure problem in this photo. Please check the photo or choose the category manually.
        </Notice>
      )}
      <dl className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <div>
          <dt className="text-[12px] text-ink-500">Detected category</dt>
          <dd className="mt-0.5 font-medium">{analysis.category_label || categoryLabel(analysis.detected_category)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-ink-500">Suggested severity</dt>
          <dd className="mt-1"><SeverityBadge severity={analysis.suggested_severity} /></dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[12px] text-ink-500">Visible observation</dt>
          <dd className="mt-0.5 text-ink-800">{analysis.visible_observation}</dd>
        </div>
        {analysis.safety_concern && (
          <div className="sm:col-span-2">
            <dt className="text-[12px] text-ink-500">Possible safety concern</dt>
            <dd className="mt-0.5 text-ink-800">{analysis.safety_concern}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-[12px] text-ink-500">{sim ? 'Heuristic score' : 'Confidence'}</dt>
          <dd className="mt-1 flex items-center gap-3">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-ink-600" style={{ width: pct(analysis.confidence_score ?? 0) }} />
            </div>
            <span className="tabular-nums font-medium">{pct(analysis.confidence_score)}</span>
          </dd>
          {analysis.confidence_note && <p className="help">{analysis.confidence_note}</p>}
        </div>
      </dl>
      <p className="text-[12px] text-ink-400">Analysed {formatDate(analysis.created_at, true)} · provider: {analysis.provider}</p>
    </div>
  );
}

/* ---------------- Status timeline ---------------- */
export function StatusTimeline({ history = [] }) {
  if (!history.length) return <p className="text-[13px] text-ink-500">No status updates yet.</p>;
  return (
    <ol className="relative space-y-5 border-l border-ink-200 pl-5">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white"
            style={{ background: STATUS_COLORS[h.new_status] || '#64748b', boxShadow: '0 0 0 1px #cbd5e1' }} />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={h.new_status} />
            <span className="text-[12px] text-ink-500">{formatDate(h.created_at, true)} · {h.changed_by}</span>
          </div>
          {h.note && <p className="mt-1 text-[13px] text-ink-700">{h.note}</p>}
          {h.evidence_url && (
            <AuthImage src={h.evidence_url} alt="Resolution evidence" className="mt-2 h-28 w-40 rounded-md border border-ink-200" />
          )}
        </li>
      ))}
    </ol>
  );
}

/* ---------------- Priority breakdown ---------------- */
const FACTOR_LABELS = {
  severity: ['S', 'Severity'],
  reports: ['R', 'Corroborating reports'],
  exposure: ['V', 'Public exposure / vulnerability'],
  waiting: ['W', 'Waiting time'],
};

export function PriorityBreakdown({ breakdown }) {
  if (!breakdown) return <p className="text-[13px] text-ink-500">Priority has not been calculated yet.</p>;
  const { score, level, factors, weights, contributions, explanations, formula, disclaimer } = breakdown;
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-ink-500">Priority score</p>
          <p className="text-[32px] font-semibold leading-none tabular-nums" style={{ color: PRIORITY_COLORS[level] }}>
            {score.toFixed(1)}
          </p>
        </div>
        <PriorityBadge level={level} />
      </div>
      <p className="font-mono text-[12px] text-ink-600">{formula}</p>
      <div className="space-y-3">
        {Object.keys(FACTOR_LABELS).map((k) => (
          <div key={k}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-800">
                <span className="kbd mr-1.5">{FACTOR_LABELS[k][0]}</span>{FACTOR_LABELS[k][1]}
              </span>
              <span className="tabular-nums text-ink-600">
                {Math.round(factors[k])} × {weights[k].toFixed(2)} = <span className="font-semibold text-ink-900">{contributions[k].toFixed(1)}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${factors[k]}%` }} />
            </div>
            {explanations?.[k] && <p className="mt-1 text-[12px] text-ink-500">{explanations[k]}</p>}
          </div>
        ))}
      </div>
      <Notice icon={Info}>{disclaimer}</Notice>
    </div>
  );
}

/* ---------------- Tables ---------------- */
export function ReportsTable({ rows, linkBase, showReporter = false, emptyTitle = 'No reports found', emptyAction }) {
  if (!rows?.length) return <EmptyState title={emptyTitle} description="Try changing the filters." action={emptyAction} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr>
            <th className="table-th w-16" />
            <th className="table-th">Report</th>
            <th className="table-th">Category</th>
            {showReporter && <th className="table-th">Reporter</th>}
            <th className="table-th">Severity</th>
            <th className="table-th">Status</th>
            <th className="table-th">Incident</th>
            <th className="table-th">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-ink-50/60">
              <td className="table-td w-16 min-w-[64px]"><AuthImage src={r.image_url} alt="" className="h-10 w-12 max-w-none rounded border border-ink-200" /></td>
              <td className="table-td">
                <Link to={`${linkBase}/${r.id}`} className="font-medium text-ink-950 hover:text-brand-700">{r.report_code}</Link>
                <p className="max-w-[260px] truncate text-[12px] text-ink-500">{r.description}</p>
                {r.is_demo && <DemoTag label="Demo" />}
              </td>
              <td className="table-td"><CategoryTag category={r.category} /></td>
              {showReporter && <td className="table-td text-[13px] text-ink-700">{r.reporter?.full_name}</td>}
              <td className="table-td text-[13px]">{cap(r.severity)}</td>
              <td className="table-td"><StatusBadge status={r.status} /></td>
              <td className="table-td text-[13px]">
                {r.incident_code ? (
                  showReporter ? <Link className="text-brand-700 hover:underline" to={`/admin/incidents/${r.incident_id}`}>{r.incident_code}</Link> : r.incident_code
                ) : <span className="text-ink-400">Not grouped</span>}
              </td>
              <td className="table-td whitespace-nowrap text-[13px] text-ink-600" title={formatDate(r.created_at, true)}>{timeAgo(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function IncidentsTable({ rows, compact = false }) {
  if (!rows?.length) return <EmptyState title="No incidents" description="Incidents appear when an administrator groups or verifies reports." />;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${compact ? '' : 'min-w-[760px]'}`}>
        <thead>
          <tr>
            <th className="table-th">Incident</th>
            {!compact && <th className="table-th">Category</th>}
            <th className="table-th">Priority</th>
            <th className="table-th">Reports</th>
            <th className="table-th">Status</th>
            {!compact && <th className="table-th">Updated</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} className="hover:bg-ink-50/60">
              <td className="table-td">
                <Link to={`/admin/incidents/${i.id}`} className="font-medium text-ink-950 hover:text-brand-700">{i.incident_code}</Link>
                <p className={`truncate text-[12px] text-ink-500 ${compact ? 'max-w-[180px]' : 'max-w-[320px]'}`}>
                  {compact ? categoryLabel(i.category) : i.description}
                </p>
              </td>
              {!compact && <td className="table-td"><CategoryTag category={i.category} /></td>}
              <td className="table-td"><PriorityBadge level={i.priority_level} score={i.priority_score} /></td>
              <td className="table-td tabular-nums">{i.supporting_report_count}</td>
              <td className="table-td"><StatusBadge status={i.status} /></td>
              {!compact && <td className="table-td whitespace-nowrap text-[13px] text-ink-600">{timeAgo(i.updated_at)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Duplicate signals ---------------- */
const SIGNAL_LABELS = { distance: 'Proximity', category: 'Category', text: 'Text', time: 'Time', image: 'Image' };

export function SignalBars({ signals }) {
  if (!signals) return null;
  return (
    <div className="grid grid-cols-5 gap-2">
      {Object.keys(SIGNAL_LABELS).map((k) => (
        <div key={k} title={signals[k] == null ? 'Not available' : `${Math.round(signals[k] * 100)}%`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full bg-ink-600" style={{ width: signals[k] == null ? 0 : `${signals[k] * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-ink-500">{SIGNAL_LABELS[k]}{signals[k] == null && ' n/a'}</p>
        </div>
      ))}
    </div>
  );
}

export function CandidateCard({ c }) {
  return (
    <div className="rounded-md border border-ink-200 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{c.report_code}</span>
          {c.incident_code && <span className="text-[12px] text-ink-500">in {c.incident_code}</span>}
          {c.is_demo && <DemoTag label="Demo" />}
        </div>
        <span className="text-[13px] tabular-nums text-ink-700">Match {Math.round(c.match_score * 100)}%</span>
      </div>
      <p className="mt-1 text-[13px] text-ink-700">{c.short_description}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-500">
        <span>{formatDistance(c.distance_m)} away</span>
        <span>{c.category_label}{c.category_match ? ' · same category' : ''}</span>
        <span>{c.status_label}</span>
        <span>{timeAgo(c.created_at)}</span>
      </div>
      <p className="mt-2 text-[12px] text-ink-600">{c.explanation}</p>
      <div className="mt-3"><SignalBars signals={c.signals} /></div>
    </div>
  );
}
