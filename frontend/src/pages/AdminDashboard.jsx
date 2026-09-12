import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';
import { Activity, Zap, BarChart3, Users, AlertCircle, CheckCircle, XCircle, Clock, TrendingUp, DollarSign } from 'lucide-react';

function KpiCard({ title, value, sub, icon: Icon, color }) {
  return (
    <div className="card" style={{ borderLeft: `4px solid ${color || 'var(--color-primary)'}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
        {Icon && <Icon size={18} color={color || 'var(--color-primary)'} />}
      </div>
      <div className="font-bold" style={{ fontSize: '1.75rem', lineHeight: 1.1 }}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

// Mini SVG bar chart
function BarChart({ data, xKey, yKey, color = 'var(--color-primary)', height = 100 }) {
  if (!data || data.length === 0) return <div className="text-muted text-sm text-center p-4">No data</div>;
  const max = Math.max(...data.map(d => parseFloat(d[yKey]) || 0), 1);
  const barW = Math.max(4, Math.floor(300 / data.length) - 2);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(300, data.length * (barW + 2))} height={height + 30} style={{ display: 'block' }}>
        {data.map((d, i) => {
          const h = Math.max(2, ((parseFloat(d[yKey]) || 0) / max) * height);
          return (
            <g key={i}>
              <rect x={i * (barW + 2)} y={height - h} width={barW} height={h} fill={color} rx={2} opacity={0.8}>
                <title>{`${d[xKey]}: ${d[yKey]}`}</title>
              </rect>
            </g>
          );
        })}
        <line x1={0} y1={height} x2={data.length * (barW + 2)} y2={height} stroke="var(--color-border)" strokeWidth={1} />
      </svg>
      <div className="flex justify-between text-xs text-muted mt-1" style={{ minWidth: Math.max(300, data.length * (barW + 2)) }}>
        {data.length > 0 && <span>{new Date(data[0][xKey]).toLocaleDateString()}</span>}
        {data.length > 1 && <span>{new Date(data[data.length - 1][xKey]).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAdminDashboard()
      .then(setData)
      .catch(err => toast.error('Failed to load admin dashboard: ' + err.toString()))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading admin dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-muted">Failed to load data.</div>;

  const statusColors = {
    SETTLED: 'var(--color-success)', CANCELLED: 'var(--color-danger)',
    DISPUTED: '#f59e0b', MATCHED: 'var(--color-primary)', LOCKED: 'var(--color-secondary)',
    DELIVERED: '#6366f1', VERIFIED: '#10b981'
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          {data.ledger_valid?.valid
            ? <span className="badge badge-success flex items-center gap-1"><CheckCircle size={12} /> Ledger Valid</span>
            : <span className="badge badge-danger flex items-center gap-1"><AlertCircle size={12} /> Ledger Invalid</span>}
        </div>
      </div>

      {/* KPI Row 1 — Transactions */}
      <h3 className="text-sm font-bold text-muted mb-4" style={{ textTransform: 'uppercase' }}>Transactions</h3>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard title="Total P2P Trades" value={data.total_trades} icon={Activity} color="var(--color-primary)" />
        <KpiCard title="Successful" value={data.settled} sub="Fully settled" icon={CheckCircle} color="var(--color-success)" />
        <KpiCard title="Cancelled" value={data.cancelled} icon={XCircle} color="var(--color-danger)" />
        <KpiCard title="Disputed" value={data.disputed} icon={AlertCircle} color="#f59e0b" />
        <KpiCard title="In Progress" value={data.pending} sub="Matched/Locked/Delivered" icon={Clock} color="var(--color-secondary)" />
        <KpiCard title="Success Rate" value={`${data.success_rate}%`} icon={TrendingUp} color="var(--color-success)" />
        <KpiCard title="Active Prosumers" value={data.active_prosumers} icon={Users} color="var(--color-primary)" />
        <KpiCard title="Active Consumers" value={data.active_consumers} icon={Users} color="var(--color-secondary)" />
      </div>

      {/* KPI Row 2 — Energy & Finance */}
      <h3 className="text-sm font-bold text-muted mb-4" style={{ textTransform: 'uppercase' }}>Energy & Finance</h3>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard title="Total Energy Traded" value={`${Number(data.total_kwh).toFixed(1)} kWh`} icon={Zap} color="var(--color-secondary)" />
        <KpiCard title="Total Trading Value" value={`$${Number(data.total_value).toFixed(2)}`} icon={DollarSign} color="var(--color-primary)" />
        <KpiCard title="Average Rate" value={`$${Number(data.avg_rate).toFixed(4)}/kWh`} icon={BarChart3} color="var(--color-primary)" />
        <KpiCard title="Platform Fees" value={`$${Number(data.platform_fees).toFixed(2)}`} icon={DollarSign} color="var(--color-success)" />
        <KpiCard title="Grid Fees" value={`$${Number(data.grid_fees).toFixed(2)}`} icon={DollarSign} color="#6366f1" />
        <KpiCard title="Refunds" value={`$${Number(data.refunds).toFixed(2)}`} icon={DollarSign} color="#f59e0b" />
        <KpiCard title="Pending Settlements" value={data.pending_settlements} icon={Clock} color="#f59e0b" />
        <KpiCard title="Completed Settlements" value={data.completed_settlements} icon={CheckCircle} color="var(--color-success)" />
      </div>

      {/* Pending Requests Banner */}
      {data.pending_requests > 0 && (
        <div className="card mb-8" style={{ border: '2px solid var(--color-secondary)', padding: '1rem 1.5rem' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} color="var(--color-secondary)" />
              <span className="font-bold">{data.pending_requests} pending user registration request{data.pending_requests > 1 ? 's' : ''}</span>
            </div>
            <a href="/admin/requests" className="btn btn-primary btn-sm">Review Requests →</a>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="mb-4">Trades Over Time (Last 30 Days)</h3>
          <BarChart data={data.chart_daily} xKey="day" yKey="count" color="var(--color-primary)" />
        </div>
        <div className="card">
          <h3 className="mb-4">Energy Traded Over Time (kWh)</h3>
          <BarChart data={data.chart_daily} xKey="day" yKey="kwh" color="var(--color-secondary)" />
        </div>
        <div className="card">
          <h3 className="mb-4">Average Rate Over Time ($/kWh)</h3>
          <BarChart data={data.chart_daily} xKey="day" yKey="avg_rate" color="#6366f1" />
        </div>
        <div className="card">
          <h3 className="mb-4">Trade Status Distribution</h3>
          {data.chart_status.length === 0 ? (
            <div className="text-muted text-sm text-center p-4">No trades yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.chart_status.map(s => (
                <div key={s.status} className="flex items-center gap-3">
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: statusColors[s.status] || '#aaa', flexShrink: 0 }} />
                  <div className="text-sm font-bold" style={{ minWidth: 90 }}>{s.status}</div>
                  <div style={{ flex: 1, height: 14, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(4, (parseInt(s.count) / data.total_trades) * 100)}%`, height: '100%', background: statusColors[s.status] || '#aaa', borderRadius: 4 }} />
                  </div>
                  <div className="text-sm font-bold" style={{ minWidth: 30, textAlign: 'right' }}>{s.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone Breakdown */}
      {data.chart_zones.length > 0 && (
        <div className="card">
          <h3 className="mb-4">Top Trading Zones</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  {['Zone', 'Trades', 'Total kWh', 'Load (kW)', 'Capacity (kW)', 'Status'].map(h => (
                    <th key={h} className="p-3 text-left text-sm font-bold text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.chart_zones.map(z => (
                  <tr key={z.zone_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="p-3 font-bold">{z.zone_name || z.zone_id}</td>
                    <td className="p-3">{z.trade_count}</td>
                    <td className="p-3">{Number(z.total_kwh).toFixed(1)}</td>
                    <td className="p-3">{z.current_load_kw}</td>
                    <td className="p-3">{z.capacity_kw}</td>
                    <td className="p-3"><span className={`badge ${z.zone_status === 'NORMAL' ? 'badge-success' : 'badge-danger'}`}>{z.zone_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
