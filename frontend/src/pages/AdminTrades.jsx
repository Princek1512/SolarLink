import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Activity, ChevronDown, ChevronUp, Lock, Zap } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';

const STATUS_BADGE = {
  MATCHED: 'badge-warning', LOCKED: 'badge-neutral', DELIVERED: 'badge-neutral',
  VERIFIED: 'badge-success', SETTLED: 'badge-success',
  DISPUTED: 'badge-danger', CANCELLED: 'badge-danger'
};

const LIFECYCLE = ['MATCHED', 'LOCKED', 'DELIVERED', 'VERIFIED', 'SETTLED'];

export default function AdminTrades() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminTrades(filter || undefined);
      setTrades(data);
    } catch (err) {
      toast.error('Failed to load trade records: ' + err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrades(); }, [filter]);

  const handleLock = async (id) => {
    try {
      await api.lockTrade(id);
      toast.success('Trade locked! Microgrid capacity reserved.');
      fetchTrades();
    } catch (err) {
      toast.error('Failed to lock trade: ' + err.toString());
    }
  };

  const handleVerifyDelivery = async (id, contractedKwh) => {
    const val = prompt(`Delivered kWh (Contracted: ${contractedKwh} kWh):`, contractedKwh);
    if (val === null) return;
    try {
      await api.verifyDelivery(id, { deliveredKwh: Number(val) });
      toast.success('Delivery recorded & trade settled on ledger!');
      fetchTrades();
    } catch (err) {
      toast.error('Verification error: ' + err.toString());
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-2.5">
            <Activity size={24} color="var(--color-primary)" />
            <h1 className="mb-0">Trade Lifecycle Monitoring</h1>
          </div>
          <p className="text-sm text-muted mb-0 mt-1">Real-time microgrid trade execution, contract verification, & settlement tracking</p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['', 'MATCHED', 'LOCKED', 'DELIVERED', 'SETTLED', 'DISPUTED', 'CANCELLED'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            >
              {s || 'All Trades'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="table-responsive p-12 text-center text-muted">Loading trade execution records…</div>
      ) : trades.length === 0 ? (
        <div className="card text-center p-12 text-muted">No trade records matching the selected filter.</div>
      ) : (
        <div className="table-responsive mb-8">
          <div className="p-4 bg-white border-b flex items-center justify-between">
            <h3 className="m-0 text-base">Microgrid Trades — <b>{trades.length} records</b></h3>
            <span className="badge badge-neutral text-xs">Click row or Manage to inspect lifecycle</span>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: '95px' }}>Status</th>
                <th style={{ width: '110px' }}>Trade ID</th>
                <th style={{ width: '100px' }}>Zone</th>
                <th>Producer (Seller)</th>
                <th>Consumer (Buyer)</th>
                <th style={{ width: '100px' }}>Quantity</th>
                <th style={{ width: '90px' }}>Rate</th>
                <th style={{ width: '90px' }}>Total Value</th>
                <th style={{ width: '160px' }}>Timestamp</th>
                <th style={{ width: '85px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(t => {
                const isExpanded = expandedId === t.id;
                const totalVal = (Number(t.quantity_kwh) * Number(t.agreed_price)).toFixed(2);
                const formattedDate = new Date(t.created_at).toLocaleDateString() + ', ' + new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <React.Fragment key={t.id}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => toggleExpand(t.id)}>
                      <td>
                        <span className={`badge ${STATUS_BADGE[t.status] || 'badge-neutral'}`}>{t.status}</span>
                      </td>
                      <td className="font-mono text-xs font-semibold text-primary">{t.id?.substring(0, 12)}…</td>
                      <td><span className="badge badge-neutral">{t.zone_name || t.zone_id}</span></td>
                      <td>
                        <div className="font-semibold text-xs text-slate-900">{t.seller_name}</div>
                        <div className="text-xs text-muted">{t.seller_email}</div>
                      </td>
                      <td>
                        <div className="font-semibold text-xs text-slate-900">{t.buyer_name}</div>
                        <div className="text-xs text-muted">{t.buyer_email}</div>
                      </td>
                      <td className="font-bold text-xs text-slate-900">{Number(t.quantity_kwh).toFixed(2)} kWh</td>
                      <td className="text-xs font-semibold">${Number(t.agreed_price).toFixed(4)}</td>
                      <td className="font-bold text-xs text-primary">${totalVal}</td>
                      <td className="text-xs text-muted font-mono" style={{ whiteSpace: 'nowrap' }}>
                        {formattedDate}
                      </td>
                      <td className="text-right">
                        <button
                          className="btn btn-outline btn-sm p-1 px-2.5 flex items-center gap-1"
                          style={{ fontSize: '0.725rem' }}
                          onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Manage
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Lifecycle Drawer */}
                    {isExpanded && (
                      <tr>
                        <td colSpan="10" className="p-0 bg-slate-50 border-b">
                          <div className="p-6 flex flex-col gap-6">
                            {/* Stepper Card */}
                            <div className="card bg-white p-5">
                              <div className="text-xs font-bold text-muted uppercase tracking-wider mb-4 pb-2 border-b">Trade Lifecycle Execution Stepper</div>
                              <div className="flex items-center justify-between">
                                {LIFECYCLE.map((step, idx) => {
                                  const currentIdx = LIFECYCLE.indexOf(t.status);
                                  const isDone = idx <= currentIdx;
                                  return (
                                    <React.Fragment key={step}>
                                      <div className="flex flex-col items-center gap-1.5">
                                        <div
                                          className="stepper-circle"
                                          style={{
                                            background: isDone ? 'var(--color-success)' : 'var(--color-border)',
                                            color: '#ffffff'
                                          }}
                                        >
                                          {isDone ? <CheckCircle size={14} /> : <Clock size={14} />}
                                        </div>
                                        <span className={`text-xs font-bold ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>{step}</span>
                                      </div>
                                      {idx < LIFECYCLE.length - 1 && (
                                        <div
                                          className="flex-1"
                                          style={{
                                            height: 3,
                                            background: idx < currentIdx ? 'var(--color-success)' : 'var(--color-border)',
                                            margin: '0 8px 18px 8px'
                                          }}
                                        />
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Actions Bar */}
                            {t.status !== 'SETTLED' && t.status !== 'CANCELLED' && (
                              <div className="p-4 rounded bg-[#fcf3ed] border border-[#e2dcd5] flex items-center justify-between">
                                <div className="text-xs font-bold text-stone-900">ADMINISTRATIVE LIFECYCLE CONTROLS</div>
                                <div className="flex gap-2">
                                  {t.status === 'MATCHED' && (
                                    <button className="btn btn-sm btn-outline" onClick={() => handleLock(t.id)}>
                                      <Lock size={13} /> Lock Capacity
                                    </button>
                                  )}
                                  {(t.status === 'MATCHED' || t.status === 'LOCKED') && (
                                    <button className="btn btn-sm btn-primary" onClick={() => handleVerifyDelivery(t.id, t.quantity_kwh)}>
                                      <Zap size={13} /> Record Meter Delivery & Settle
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Financial Settlement Info */}
                            {t.settlement_status && (
                              <div className="card bg-white p-4">
                                <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Financial Settlement Breakdown</div>
                                <div className="grid grid-cols-4 gap-4 text-xs">
                                  <div><span className="text-muted block">Gross Amount</span><span className="font-bold text-slate-900">${Number(t.gross_amount || 0).toFixed(2)}</span></div>
                                  <div><span className="text-muted block">Platform Fee</span><span className="font-bold text-slate-900">${Number(t.platform_fee || 0).toFixed(2)}</span></div>
                                  <div><span className="text-muted block">Grid Fee</span><span className="font-bold text-slate-900">${Number(t.grid_fee || 0).toFixed(2)}</span></div>
                                  <div><span className="text-muted block">Seller Net Credit</span><span className="font-bold text-primary">${Number(t.seller_credit || 0).toFixed(2)}</span></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .stepper-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
