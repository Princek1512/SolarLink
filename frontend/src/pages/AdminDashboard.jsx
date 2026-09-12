import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';
import { Activity, Zap, BarChart3, Users, AlertCircle, CheckCircle, XCircle, Clock, TrendingUp, DollarSign } from 'lucide-react';

function KpiCard({ title, value, sub, icon: Icon, color = 'var(--color-primary)' }) {
  return (
    <div className="card kpi-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-muted uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="icon-wrapper">
            <Icon size={16} color={color} />
          </div>
        )}
      </div>
      <div className="font-bold text-2xl text-slate-900" style={{ fontFamily: 'var(--font-body)', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1 font-medium">{sub}</div>}
    </div>
  );
}

function BarChart({ data, xKey, yKey, color = '#1D3557', height = 110 }) {
  if (!data || data.length === 0) return <div className="text-muted text-sm text-center p-6">No historical data available</div>;
  const max = Math.max(...data.map(d => parseFloat(d[yKey]) || 0), 1);
  const barW = Math.max(6, Math.floor(300 / data.length) - 3);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(300, data.length * (barW + 3))} height={height + 25} style={{ display: 'block', margin: '0 auto' }}>
        {data.map((d, i) => {
          const h = Math.max(3, ((parseFloat(d[yKey]) || 0) / max) * height);
          return (
            <g key={i}>
              <rect x={i * (barW + 3)} y={height - h} width={barW} height={h} fill={color} rx={2} opacity={0.95}>
                <title>{`${d[xKey]}: ${d[yKey]}`}</title>
              </rect>
            </g>
          );
        })}
        <line x1={0} y1={height} x2={data.length * (barW + 3)} y2={height} stroke="var(--color-border)" strokeWidth={1} />
      </svg>
      <div className="flex justify-between text-xs text-muted mt-2 font-mono">
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

  if (loading) return <div className="card text-center p-12 text-muted">Loading executive analytics…</div>;
  if (!data) return <div className="card text-center p-12 text-muted">Failed to load data.</div>;

  const statusColors = {
    SETTLED: 'var(--color-success)', CANCELLED: 'var(--color-danger)',
    DISPUTED: 'var(--color-warning)', MATCHED: 'var(--color-primary-accent)', LOCKED: '#1D3557',
    DELIVERED: '#4b5563', VERIFIED: 'var(--color-success)'
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h1 className="mb-1">Executive Admin Dashboard</h1>
          <p className="text-sm text-muted mb-0">Institutional overview, trade execution metrics, & microgrid ledger integrity</p>
        </div>
        <div className="flex items-center gap-2">
          {data.ledger_valid?.valid
            ? <span className="badge badge-success flex items-center gap-1.5"><CheckCircle size={13} /> Ledger HashChain Verified</span>
            : <span className="badge badge-danger flex items-center gap-1.5"><AlertCircle size={13} /> Integrity Warning</span>}
        </div>
      </div>

      {/* KPI Row 1 — Transactions */}
      <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Trading & User Performance</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard title="Total P2P Trades" value={data.total_trades} icon={Activity} color="#1D3557" />
        <KpiCard title="Successful Trades" value={data.settled} sub="Fully settled" icon={CheckCircle} color="var(--color-success)" />
        <KpiCard title="Cancelled Trades" value={data.cancelled} icon={XCircle} color="var(--color-danger)" />
        <KpiCard title="Disputed Trades" value={data.disputed} icon={AlertCircle} color="var(--color-warning)" />
        <KpiCard title="In Progress" value={data.pending} sub="Matched / Locked / Delivered" icon={Clock} color="var(--color-primary-accent)" />
        <KpiCard title="Success Rate" value={`${data.success_rate}%`} icon={TrendingUp} color="var(--color-success)" />
        <KpiCard title="Active Prosumers" value={data.active_prosumers} icon={Users} color="#1D3557" />
        <KpiCard title="Active Consumers" value={data.active_consumers} icon={Users} color="var(--color-gold)" />
      </div>

      {/* KPI Row 2 — Energy & Finance */}
      <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Energy & Financial Volume</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiCard title="Total Energy Traded" value={`${Number(data.total_kwh).toFixed(1)} kWh`} icon={Zap} color="var(--color-gold)" />
        <KpiCard title="Total Trading Value" value={`$${Number(data.total_value).toFixed(2)}`} icon={DollarSign} color="#1D3557" />
        <KpiCard title="Average Rate" value={`$${Number(data.avg_rate).toFixed(4)}/kWh`} icon={BarChart3} color="var(--color-primary-accent)" />
        <KpiCard title="Platform Fees" value={`$${Number(data.platform_fees).toFixed(2)}`} icon={DollarSign} color="var(--color-success)" />
        <KpiCard title="Grid Fees" value={`$${Number(data.grid_fees).toFixed(2)}`} icon={DollarSign} color="#1D3557" />
        <KpiCard title="Refunds Issued" value={`$${Number(data.refunds).toFixed(2)}`} icon={DollarSign} color="var(--color-warning)" />
        <KpiCard title="Pending Settlements" value={data.pending_settlements} icon={Clock} color="var(--color-warning)" />
        <KpiCard title="Completed Settlements" value={data.completed_settlements} icon={CheckCircle} color="var(--color-success)" />
      </div>

      {/* Pending Requests Banner */}
      {data.pending_requests > 0 && (
        <div className="card mb-8 banner-alert">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} color="var(--color-warning)" />
              <span className="font-semibold text-sm">There {data.pending_requests > 1 ? 'are' : 'is'} <b>{data.pending_requests} pending user registration request{data.pending_requests > 1 ? 's' : ''}</b> awaiting review.</span>
            </div>
            <a href="/admin/requests" className="btn btn-primary btn-sm">Review Queue →</a>
          </div>
        </div>
      )}

      {/* Analytics Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="mb-4">Trades Volume (Last 30 Days)</h3>
          <BarChart data={data.chart_daily} xKey="day" yKey="count" color="#1D3557" />
        </div>
        <div className="card">
          <h3 className="mb-4">Energy Volume Traded (kWh)</h3>
          <BarChart data={data.chart_daily} xKey="day" yKey="kwh" color="#1D3557" />
        </div>
        <div className="card">
          <h3 className="mb-4">Average Rate Trend ($/kWh)</h3>
          <BarChart data={data.chart_daily} xKey="day" yKey="avg_rate" color="#1D3557" />
        </div>
        <div className="card">
          <h3 className="mb-4">Trade Lifecycle Distribution</h3>
          {data.chart_status.length === 0 ? (
            <div className="text-muted text-sm text-center p-6">No trades recorded yet</div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.chart_status.map(s => (
                <div key={s.status} className="flex items-center gap-3">
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: statusColors[s.status] || '#aaa', flexShrink: 0 }} />
                  <div className="text-sm font-semibold" style={{ minWidth: 90 }}>{s.status}</div>
                  <div className="flex-1" style={{ height: 8, background: '#eef2f5', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(4, (parseInt(s.count) / data.total_trades) * 100)}%`, height: '100%', background: statusColors[s.status] || '#aaa', borderRadius: 2 }} />
                  </div>
                  <div className="text-xs font-bold text-muted font-mono" style={{ minWidth: 35, textAlign: 'right' }}>{s.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone Breakdown Table */}
      {data.chart_zones.length > 0 && (
        <div className="table-responsive">
          <div className="p-4 bg-white border-b flex items-center justify-between">
            <h3 className="m-0 text-base">Top Trading Grid Zones</h3>
          </div>
          <table>
            <thead>
              <tr>
                {['Zone Name / ID', 'Trade Count', 'Total Energy (kWh)', 'Current Load (kW)', 'Capacity (kW)', 'Grid Status'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.chart_zones.map(z => (
                <tr key={z.zone_id}>
                  <td className="font-semibold">{z.zone_name || z.zone_id}</td>
                  <td>{z.trade_count}</td>
                  <td>{Number(z.total_kwh).toFixed(1)} kWh</td>
                  <td>{z.current_load_kw} kW</td>
                  <td>{z.capacity_kw} kW</td>
                  <td><span className={`badge ${z.zone_status === 'NORMAL' ? 'badge-success' : 'badge-danger'}`}>{z.zone_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .kpi-card {
          padding: 1.15rem;
          border-top: 3px solid var(--color-primary);
        }
        .icon-wrapper {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          background-color: var(--color-neutral-bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .banner-alert {
          border-left: 4px solid var(--color-warning);
          background-color: var(--color-warning-bg);
        }
        .text-2xl {
          font-size: 1.55rem;
        }
      `}</style>
    </div>
  );
}
