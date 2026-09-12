import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';
import { Activity, Zap, BarChart3, Users, AlertCircle, CheckCircle, XCircle, Clock, TrendingUp, DollarSign, ShieldAlert, Sun, ArrowUpRight } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

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

const STATUS_COLORS = {
  SETTLED: '#15803d',
  VERIFIED: '#16a34a',
  MATCHED: '#8c5638',
  LOCKED: '#1D3557',
  DELIVERED: '#4b5563',
  DISPUTED: '#d97706',
  CANCELLED: '#dc2626',
  PENDING: '#8c5638'
};

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

  const pieData = (data.chart_status || []).map(s => ({
    name: s.status,
    value: parseInt(s.count),
    color: STATUS_COLORS[s.status] || '#8c5638'
  }));

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

      {/* Interactive Analytics Charts */}
      <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Marketplace Analytics & Insights</h2>
      <div className="grid grid-cols-2 gap-6 mb-8">
        
        {/* Chart 1: 14-Day Energy Trading Volume */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="m-0 text-base">Energy Trading Volume Trend (kWh)</h3>
              <span className="text-xs text-muted">Daily total energy exchanged across microgrid zones</span>
            </div>
            <div className="text-xs font-bold px-2.5 py-1 rounded bg-slate-100 font-mono" style={{ color: '#1D3557' }}>
              14-Day Timeline
            </div>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chart_daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorKwh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D3557" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#1D3557" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2dcd5" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={{ stroke: '#e2dcd5' }} />
                <YAxis tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(val, name) => [name === 'kwh' ? `${val} kWh` : `$${val}`, name === 'kwh' ? 'Energy Traded' : 'Total Value']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2dcd5', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="kwh" stroke="#1D3557" strokeWidth={2.5} fillOpacity={1} fill="url(#colorKwh)" name="kwh" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: P2P Solar Rate vs Utility Grid Rates */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="m-0 text-base">Tariff Comparison ($/kWh)</h3>
              <span className="text-xs text-muted">P2P Solar Rate vs Utility Retail & Feed-in Rates</span>
            </div>
            <span className="badge badge-success">Save ~35% vs Grid</span>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chart_daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2dcd5" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={{ stroke: '#e2dcd5' }} />
                <YAxis domain={[0.05, 0.25]} tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(val) => [`$${Number(val).toFixed(4)}/kWh`]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2dcd5', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line type="monotone" dataKey="grid_retail_rate" name="Utility Grid Retail ($0.22)" stroke="#8c5638" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="p2p_rate" name="P2P Solar Agreed Rate" stroke="#1D3557" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="feed_in_rate" name="Utility Buyback Tariff ($0.08)" stroke="#15803d" strokeWidth={2} strokeDasharray="2 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: 24-Hour Solar Generation vs Load Demand Curve */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="m-0 text-base">24-Hour Generation vs Demand Curve</h3>
              <span className="text-xs text-muted">Solar peak output vs microgrid consumer demand</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <Sun size={13} /> Peak 10am - 3pm
            </div>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chart_hourly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02}/>
                  </linearGradient>
                  <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D3557" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#1D3557" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2dcd5" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#78716c' }} axisLine={{ stroke: '#e2dcd5' }} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} unit=" kW" />
                <Tooltip 
                  formatter={(val) => [`${val} kW`]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2dcd5', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area type="monotone" dataKey="solar_generation_kw" name="Solar Power Generation (kW)" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorSolar)" />
                <Area type="monotone" dataKey="grid_demand_kw" name="Consumer Energy Demand (kW)" stroke="#1D3557" strokeWidth={2} fillOpacity={1} fill="url(#colorDemand)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Trade Status Lifecycle & Health Breakdown */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="m-0 text-base">Trade Lifecycle Health</h3>
              <span className="text-xs text-muted">Status distribution & settlement completion</span>
            </div>
            <span className="badge badge-neutral">{data.total_trades} Trades</span>
          </div>
          
          <div className="flex items-center gap-4" style={{ height: 240 }}>
            {/* Pie Chart */}
            <div style={{ width: '45%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.length > 0 ? pieData : [{ name: 'Settled', value: 1, color: '#15803d' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(pieData.length > 0 ? pieData : [{ name: 'Settled', value: 1, color: '#15803d' }]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val, name) => [`${val} trades`, name]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2dcd5', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Progress Legend */}
            <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-1" style={{ maxHeight: '220px' }}>
              {(data.chart_status || []).map(s => {
                const color = STATUS_COLORS[s.status] || '#8c5638';
                const pct = data.total_trades > 0 ? ((parseInt(s.count) / data.total_trades) * 100).toFixed(0) : 100;
                return (
                  <div key={s.status} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                        <span>{s.status}</span>
                      </div>
                      <span className="font-mono text-muted">{s.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, width: '100%', background: '#eae4dd', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(6, pct)}%`, height: '100%', background: color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Zone Breakdown Table */}
      {data.chart_zones.length > 0 && (
        <div className="table-responsive">
          <div className="p-4 bg-white border-b flex items-center justify-between">
            <h3 className="m-0 text-base">Top Trading Grid Zones & Network Capacity</h3>
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

