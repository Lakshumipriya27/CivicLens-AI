import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import {
  CATEGORY_COLORS, PRIORITY_COLORS, STATUS_COLORS, cap, categoryLabel, statusLabel,
} from '../../utils/format';

export const DEFAULT_CENTER = [13.0418, 80.2341];
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function incidentIcon(inc) {
  const color = inc.status === 'resolved' ? STATUS_COLORS.resolved : PRIORITY_COLORS[inc.priority_level] || '#475569';
  const n = inc.supporting_report_count || 1;
  const size = Math.min(40, 24 + n * 3);
  return L.divIcon({
    className: 'civic-marker',
    html: `<div class="civic-pin" style="width:${size}px;height:${size}px;background:${color};${inc.status === 'resolved' ? 'opacity:.75' : ''}">${n}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function reportIcon(rep) {
  const color = CATEGORY_COLORS[rep.category] || '#64748b';
  return L.divIcon({
    className: 'civic-marker',
    html: `<div class="civic-dot" style="width:14px;height:14px;background:${color}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  });
}

const pinIcon = L.divIcon({
  className: 'civic-marker',
  html: `<svg width="28" height="38" viewBox="0 0 28 38"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 38 14 38s14-13.7 14-24.1C28 6.2 21.7 0 14 0z" fill="#1a5e55"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,
  iconSize: [28, 38],
  iconAnchor: [14, 38],
});

function FitBounds({ points, fitKey }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  return null;
}

/**
 * Interactive civic map: grouped incidents (numbered, coloured by priority) and
 * ungrouped reports (small dots, coloured by category).
 */
export function CivicMap({ incidents = [], reports = [], height = 520, linkFor, className = '' }) {
  const points = useMemo(
    () => [...incidents, ...reports].map((p) => [p.latitude, p.longitude]),
    [incidents, reports],
  );
  const fitKey = `${incidents.length}-${reports.length}-${incidents[0]?.id ?? ''}`;

  return (
    <div className={`overflow-hidden rounded-lg border border-ink-200 ${className}`} style={{ height }}>
      <MapContainer center={DEFAULT_CENTER} zoom={14} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <FitBounds points={points} fitKey={fitKey} />
        {reports.map((r) => (
          <Marker key={`r${r.id}`} position={[r.latitude, r.longitude]} icon={reportIcon(r)}>
            <Popup>
              <div className="min-w-[200px]">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Individual report · not yet grouped</p>
                <p className="mt-0.5 font-semibold text-ink-950">{r.report_code}</p>
                <p className="text-ink-700">{categoryLabel(r.category)}</p>
                <p className="mt-1 text-ink-600">{r.short_description}</p>
                <p className="mt-1.5 text-[12px] text-ink-500">Status: {statusLabel(r.status)} · {cap(r.severity)} severity</p>
                {r.is_demo && <p className="mt-1 text-[11px] text-ink-400">Fictional demonstration record</p>}
                {linkFor && linkFor('report', r) && (
                  <Link to={linkFor('report', r)} className="mt-2 inline-block font-medium text-brand-700">Open report →</Link>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        {incidents.map((i) => (
          <Marker key={`i${i.id}`} position={[i.latitude, i.longitude]} icon={incidentIcon(i)}>
            <Popup>
              <div className="min-w-[220px]">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Incident</p>
                <p className="mt-0.5 font-semibold text-ink-950">{i.incident_code}</p>
                <p className="text-ink-700">{categoryLabel(i.category)}</p>
                <p className="mt-1 text-ink-600">{i.short_description || i.description}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <span className="text-ink-500">Priority</span>
                  <span className="font-medium" style={{ color: PRIORITY_COLORS[i.priority_level] }}>
                    {Math.round(i.priority_score)} · {cap(i.priority_level)}
                  </span>
                  <span className="text-ink-500">Linked reports</span><span className="font-medium">{i.supporting_report_count}</span>
                  <span className="text-ink-500">Status</span><span className="font-medium">{statusLabel(i.status)}</span>
                </div>
                {i.is_demo && <p className="mt-1.5 text-[11px] text-ink-400">Fictional demonstration record</p>}
                {linkFor && linkFor('incident', i) && (
                  <Link to={linkFor('incident', i)} className="mt-2 inline-block font-medium text-brand-700">Open incident →</Link>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink-600">
      <span className="font-medium text-ink-800">Incidents (number = linked reports):</span>
      {['critical', 'high', 'moderate', 'low'].map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: PRIORITY_COLORS[l] }} /> {cap(l)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full opacity-75" style={{ background: STATUS_COLORS.resolved }} /> Resolved
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border border-white ring-1 ring-ink-400 bg-ink-500" /> Ungrouped report (colour = category)
      </span>
    </div>
  );
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng }) });
  return null;
}

function Recenter({ value }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.latitude, value.longitude], Math.max(map.getZoom(), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.latitude, value?.longitude]);
  return null;
}

/** Click the map (or drag the pin) to set the report location. */
export function LocationPicker({ value, onChange, height = 320 }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-200" style={{ height }}>
      <MapContainer center={value ? [value.latitude, value.longitude] : DEFAULT_CENTER} zoom={value ? 16 : 13}
        style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <ClickHandler onPick={onChange} />
        <Recenter value={value} />
        {value && (
          <Marker
            position={[value.latitude, value.longitude]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const ll = e.target.getLatLng();
                onChange({ latitude: ll.lat, longitude: ll.lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
