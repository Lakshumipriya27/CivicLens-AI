import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, ImageOff, Inbox, Loader2, X } from 'lucide-react';
import { fetchImageBlob } from '../../services/endpoints';
import {
  PRIORITY_COLORS, STATUS_COLORS, cap, categoryLabel, statusLabel,
} from '../../utils/format';

/* ---------------- Buttons ---------------- */
const BTN = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 border border-brand-700',
  secondary: 'bg-white text-ink-800 border border-ink-300 hover:bg-ink-50',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100 border border-transparent',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  dark: 'bg-ink-900 text-white border border-ink-900 hover:bg-ink-800',
};
const SIZES = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-4 text-[14px]', lg: 'h-11 px-5 text-[15px]' };

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className = '', ...rest }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-55 ${BTN[variant]} ${SIZES[size]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

/* ---------------- Form fields ---------------- */
export function Field({ label, htmlFor, help, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p className="error-text">{error}</p> : help ? <p className="help">{help}</p> : null}
    </div>
  );
}

export const Input = (props) => <input {...props} className={`input ${props.className || ''}`} />;
export const Textarea = (props) => <textarea rows={4} {...props} className={`input ${props.className || ''}`} />;
export function Select({ options, placeholder, className = '', ...rest }) {
  return (
    <select {...rest} className={`input pr-8 ${className}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/* ---------------- Badges ---------------- */
function Dot({ color }) {
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />;
}

export function Badge({ children, color = '#64748b', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[12px] font-medium ${className}`}
      style={{ color, borderColor: `${color}40`, background: `${color}0f` }}
    >
      <Dot color={color} />
      {children}
    </span>
  );
}

export const StatusBadge = ({ status }) => <Badge color={STATUS_COLORS[status]}>{statusLabel(status)}</Badge>;

export function PriorityBadge({ level, score }) {
  if (!level) return <span className="muted">—</span>;
  return (
    <Badge color={PRIORITY_COLORS[level]}>
      {cap(level)}{score != null && <span className="font-semibold tabular-nums">{Math.round(score)}</span>}
    </Badge>
  );
}

const SEV = { low: '#64748b', medium: '#b58105', high: '#c4570a', critical: '#b42318' };
export const SeverityBadge = ({ severity }) => <Badge color={SEV[severity]}>{cap(severity)} severity</Badge>;

export function CategoryTag({ category }) {
  return <span className="text-[13px] text-ink-800">{categoryLabel(category)}</span>;
}

export function DemoTag({ show = true, label = 'Fictional demo record' }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center rounded border border-dashed border-ink-300 px-1.5 py-px text-[11px] font-medium uppercase tracking-wide text-ink-500">
      {label}
    </span>
  );
}

/* ---------------- Layout pieces ---------------- */
export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-ink-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '', pad = true, subtitle }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          <div>
            <h2 className="section-title">{title}</h2>
            {subtitle && <p className="text-[12px] text-ink-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default' }) {
  const toneCls = tone === 'alert' ? 'text-red-700' : tone === 'good' ? 'text-brand-700' : 'text-ink-950';
  return (
    <div className="card px-4 py-4">
      <div className="flex items-center justify-between text-[13px] text-ink-500">
        <span>{label}</span>
        {Icon && <Icon className="h-4 w-4 text-ink-400" />}
      </div>
      <div className={`mt-2 text-[26px] font-semibold tabular-nums leading-none ${toneCls}`}>{value ?? '—'}</div>
      {hint && <div className="mt-2 text-[12px] text-ink-500">{hint}</div>}
    </div>
  );
}

/* ---------------- States ---------------- */
export function Spinner({ className = '' }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-ink-400 ${className}`} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center gap-3 text-ink-500">
      <Spinner /> <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-ink-50">
        <Icon className="h-5 w-5 text-ink-400" />
      </div>
      <p className="font-medium text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-red-600" />
      <p className="max-w-md text-ink-700">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={() => onRetry()}>Try again</Button>}
    </div>
  );
}

export function Notice({ tone = 'info', title, children, icon: Icon }) {
  const tones = {
    info: 'border-ink-200 bg-ink-50 text-ink-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-brand-200 bg-brand-50 text-brand-900',
  };
  return (
    <div className={`flex gap-3 rounded-md border px-3.5 py-3 text-[13px] ${tones[tone]}`}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        {title && <p className="font-medium">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-ink-950/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={`card w-full ${width} shadow-pop`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 className="section-title">{title}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', variant = 'primary', loading, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      <div className="text-ink-700">{message}</div>
    </Modal>
  );
}

/* ---------------- Pagination ---------------- */
export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-[13px] text-ink-600">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Authenticated image ---------------- */
// Uploaded photos are served only to authorised users, so they are fetched with the auth header.
export function AuthImage({ src, alt, className = '', onClick }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!src) return undefined;
    let objectUrl;
    let alive = true;
    setFailed(false);
    setUrl(null);
    fetchImageBlob(src)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-ink-100 text-ink-400 ${className}`}>
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }
  if (!url) return <div className={`animate-pulse bg-ink-100 ${className}`} />;
  return (
    <img
      src={url}
      alt={alt}
      className={`object-cover ${onClick ? 'cursor-zoom-in' : ''} ${className}`}
      onClick={onClick ? () => onClick(url) : undefined}
    />
  );
}

export function ImageLightbox({ url, onClose }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-ink-950/80 p-6" onClick={onClose}>
      <img src={url} alt="Full size" className="max-h-full max-w-full rounded-md" />
      <button className="absolute right-4 top-4 text-white" aria-label="Close"><X className="h-6 w-6" /></button>
    </div>
  );
}

export function KeyValue({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-32 shrink-0 text-[13px] text-ink-500">{label}</dt>
      <dd className="min-w-0 text-ink-900">{children}</dd>
    </div>
  );
}
