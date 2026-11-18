import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { EmptyState } from '../common/ui';
import { CATEGORY_COLORS, PRIORITY_COLORS, STATUS_COLORS, cap } from '../../utils/format';

const axis = { fontSize: 12, fill: '#64748b' };
const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxShadow: '0 8px 24px -6px rgba(16,24,40,.18)' };

export function CategoryChart({ data, height = 280 }) {
  if (!data?.length) return <EmptyState title="No reports yet" description="Category distribution appears once reports are submitted." />;
  const rows = data.map((d) => ({ ...d, short: d.label.split(' / ')[0].replace('Overflowing ', '').replace('Damaged Public ', '') }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#eef1f4" />
        <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="short" width={112} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} labelFormatter={(_, p) => p?.[0]?.payload?.label} />
        <Bar dataKey="reports" name="Reports" radius={[0, 4, 4, 0]} barSize={14}>
          {rows.map((d) => <Cell key={d.category} fill={CATEGORY_COLORS[d.category] || '#64748b'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusChart({ data, height = 260 }) {
  const rows = (data || []).filter((d) => d.count > 0);
  if (!rows.length) return <EmptyState title="No incidents yet" description="Status distribution appears once incidents exist." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#eef1f4" />
        <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={96} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="count" name="Incidents" radius={[0, 4, 4, 0]} barSize={16}>
          {rows.map((d) => <Cell key={d.status} fill={STATUS_COLORS[d.status]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PriorityChart({ data, height = 220 }) {
  const total = (data || []).reduce((a, b) => a + b.count, 0);
  if (!total) return <EmptyState title="No open incidents" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#eef1f4" />
        <XAxis dataKey="level" tickFormatter={cap} tick={axis} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} labelFormatter={cap} />
        <Bar dataKey="count" name="Open incidents" radius={[4, 4, 0, 0]} barSize={32}>
          {data.map((d) => <Cell key={d.level} fill={PRIORITY_COLORS[d.level]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyChart({ data, height = 280 }) {
  const total = (data || []).reduce((a, b) => a + b.reports + b.resolved_incidents, 0);
  if (!total) return <EmptyState title="No activity in this period" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -16, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#eef1f4" />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Line type="linear" dataKey="reports" name="Reports submitted" stroke="#1d7568" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="linear" dataKey="resolved_incidents" name="Incidents resolved" stroke="#475569" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
