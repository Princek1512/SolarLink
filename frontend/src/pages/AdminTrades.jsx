import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Activity } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';

const STATUS_BADGE = {
  MATCHED: 'badge-neutral', LOCKED: 'badge-neutral', DELIVERED: 'badge-neutral',
  VERIFIED: 'badge-success', SETTLED: 'badge-success',
  DISPUTED: 'badge-danger', CANCELLED: 'badge-danger'
};

const LIFECYCLE = ['MATCHED', 'LOCKED', 'DELIVERED', 'VERIFIED', 'SETTLED'];

export default function AdminTrades() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(null);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminTrades(filter || undefined);
      setTrades(data);
    } catch (err) {
      toast.error('Failed to load trades: ' + err.toString());
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
      toast.success('Delivery recorded & trade settled!');
      fetchTrades();
    } catch (err) {
      toast.error('Verification error: ' + err.toString());
    }
  };

  const handleAutoProgress = async (id) => {
    try {
      await api.progressTrade(id);
      toast.success('Trade auto-progressed to SETTLED!');
      fetchTrades();
    } catch (err) {
      toast.error('Auto-progress failed: ' + err.toString());
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Activity size={28} color="var(--color-primary)" />
          <h1 style={{ margin: 0 }}>Trade Monitoring</h1>
        </div>
        <div className="flex items-center gap-2">
          {['', 'MATCHED', 'LOCKED', 'DELIVERED', 'SETTLED', 'DISPUTED', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">Loading trades...</div>
      ) : trades.length === 0 ? (
        <div className="card text-center p-8 text-muted">No trades found.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {trades.map(t => (
            <div key={t.id} className="card" style={{ padding: 0 }}>
              {/* Header Row */}
              <div
                className="flex flex-wrap items-center justify-between gap-4 p-4 cursor-pointer"
                style={{ borderBottom: expanded === t.id ? '1px solid var(--color-border)' : 'none' }}
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                <div className="flex items-center gap-3">
                  <span className={`badge ${STATUS_BADGE[t.status] || 'badge-neutral'}`}>{t.status}</span>
                  <span className="text-xs font-mono text-muted">{t.id?.substring(0, 16)}…</span>
                  <span className="badge badge-neutral text-xs">{t.zone_name || t.zone_id}</span>
                </div>
                <div className="flex gap-6 text-sm">
                  <div><span className="text-muted">Qty:</span> <span className="font-bold">{Number(t.quantity_kwh).toFixed(2)} kWh</span></div>
                  <div><span className="text-muted">Price:</span> <span className="font-bold">${Number(t.agreed_price).toFixed(4)}/kWh</span></div>
                  <div><span className="text-muted">Value:</span> <span className="font-bold">${(Number(t.quantity_kwh) * Number(t.agreed_price)).toFixed(2)}</span></div>
                  <div className="text-muted text-xs">{new Date(t.created_at).toLocaleString()}</div>
                </div>
              </div>

              {/* Expanded Detail */}
              {expanded === t.id && (
                <div className="p-4">
                  {/* Lifecycle Progress */}
                  <div className="mb-4">
                    <div className="text-xs font-bold text-muted mb-2">TRADE LIFECYCLE</div>
                    <div className="flex items-center gap-2">
                      {LIFECYCLE.map((step, idx) => {
                        const stepIdx = LIFECYCLE.indexOf(t.status);
                        const isDisputed = t.status === 'DISPUTED';
                        const isCancelled = t.status === 'CANCELLED';
                        const done = idx <= stepIdx || (!isDisputed && !isCancelled && stepIdx >= 0);
                        return (
                          <React.Fragment key={step}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: idx <= LIFECYCLE.indexOf(t.status) ? 'var(--color-success)' : 'var(--color-border)',
                                color: 'white'
                              }}>
                                {idx <= LIFECYCLE.indexOf(t.status) ? <CheckCircle size={14} /> : <Clock size={14} color="var(--color-text-secondary)" />}
                              </div>
                              <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{step}</span>
                            </div>
                            {idx < LIFECYCLE.length - 1 && (
                              <div style={{ flex: 1, height: 2, background: idx < LIFECYCLE.indexOf(t.status) ? 'var(--color-success)' : 'var(--color-border)', marginBottom: 20 }} />
                            )}
                          </React.Fragment>
                        );
                      })}
                      {t.status === 'DISPUTED' && (
                        <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={24} color="var(--color-danger)" />
                          <span className="text-xs font-bold" style={{ color: 'var(--color-danger)' }}>DISPUTED</span>
                        </div>
                      )}
                      {t.status === 'CANCELLED' && (
                        <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <XCircle size={24} color="var(--color-danger)" />
                          <span className="text-xs font-bold" style={{ color: 'var(--color-danger)' }}>CANCELLED</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  {t.status !== 'SETTLED' && t.status !== 'CANCELLED' && (
                    <div className="p-3 mb-4 rounded flex items-center justify-between gap-4" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                      <div className="text-xs font-bold" style={{ color: '#3730a3' }}>LIFECYCLE ACTIONS</div>
                      <div className="flex gap-2">
                        {t.status === 'MATCHED' && (
                          <button className="btn btn-sm btn-outline" onClick={() => handleLock(t.id)}>
                            🔒 Lock Trade
                          </button>
                        )}
                        {(t.status === 'MATCHED' || t.status === 'LOCKED') && (
                          <button className="btn btn-sm btn-primary" onClick={() => handleVerifyDelivery(t.id, t.quantity_kwh)}>
                            ⚡ Record Delivery & Verify
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Parties */}
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div className="p-3 rounded" style={{ background: 'var(--color-bg)' }}>
                      <div className="text-xs font-bold text-muted mb-2">PRODUCER (SELLER)</div>
                      <div className="font-bold">{t.seller_name}</div>
                      <div className="text-xs text-muted">{t.seller_email}</div>
                      <div className="text-xs text-muted">{t.seller_role}</div>
                    </div>
                    <div className="p-3 rounded" style={{ background: 'var(--color-bg)' }}>
                      <div className="text-xs font-bold text-muted mb-2">CONSUMER (BUYER)</div>
                      <div className="font-bold">{t.buyer_name}</div>
                      <div className="text-xs text-muted">{t.buyer_email}</div>
                      <div className="text-xs text-muted">{t.buyer_role}</div>
                    </div>
                  </div>

                  {/* Settlement */}
                  {t.settlement_status && (
                    <div className="p-3 rounded mb-4" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                      <div className="text-xs font-bold text-muted mb-2">SETTLEMENT</div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div><div className="text-xs text-muted">Gross</div><div className="font-bold">${Number(t.gross_amount || 0).toFixed(2)}</div></div>
                        <div><div className="text-xs text-muted">Platform Fee</div><div className="font-bold">${Number(t.platform_fee || 0).toFixed(2)}</div></div>
                        <div><div className="text-xs text-muted">Grid Fee</div><div className="font-bold">${Number(t.grid_fee || 0).toFixed(2)}</div></div>
                        <div><div className="text-xs text-muted">Seller Credit</div><div className="font-bold">${Number(t.seller_credit || 0).toFixed(2)}</div></div>
                      </div>
                      <div className="text-xs text-muted mt-2">Settled at: {t.settled_at ? new Date(t.settled_at).toLocaleString() : '—'}</div>
                    </div>
                  )}

                  {/* Dispute */}
                  {t.shortfall_percent !== null && t.shortfall_percent !== undefined && (
                    <div className="p-3 rounded" style={{ background: '#fff3cd', border: '1px solid #f59e0b' }}>
                      <div className="text-xs font-bold mb-2" style={{ color: '#92400e' }}>DISPUTE DETAILS</div>
                      <div className="text-sm">
                        Contracted: <b>{t.contracted_kwh} kWh</b> | Delivered: <b>{t.delivered_kwh} kWh</b> | Shortfall: <b>{Number(t.shortfall_percent).toFixed(1)}%</b>
                      </div>
                      {t.resolution && <div className="text-xs mt-2">Resolution: {t.resolution}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
