import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';

export default function Disputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionData, setResolutionData] = useState({ resolution: '', refund_amount: '' });

  const fetchDisputes = () => {
    setLoading(true);
    api.getDisputes()
      .then(setDisputes)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleResolveClick = (dispute) => {
    setResolvingId(dispute.trade_id);
    setResolutionData({
      resolution: dispute.resolution || 'Resolved by Admin after meter audit verification.',
      refund_amount: dispute.refund_amount || 0
    });
  };

  const handleResolveSubmit = async (e, tradeId) => {
    e.preventDefault();
    try {
      await api.resolveDispute(tradeId, {
        resolution: resolutionData.resolution,
        refund_amount: Number(resolutionData.refund_amount)
      });
      toast.success('Dispute settled & resolution logged to blockchain ledger.');
      setResolvingId(null);
      fetchDisputes();
    } catch (err) {
      toast.error('Error resolving dispute: ' + err.message);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert size={24} color="var(--color-danger)" />
            <h1 className="mb-0">Disputes & Meter Audits</h1>
          </div>
          <p className="text-sm text-muted mb-0 mt-1">Review shortfalls between contracted energy vs smart meter delivery</p>
        </div>
      </div>

      {loading ? (
        <div className="card text-center p-12 text-muted">Loading trade dispute records…</div>
      ) : disputes.length === 0 ? (
        <div className="card text-center p-12 text-muted">
          <CheckCircle size={40} color="var(--color-success)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
          <p className="text-base font-semibold text-slate-800 mb-1">No Active Trade Disputes</p>
          <span className="text-xs text-muted">All microgrid energy trades match meter readings within allowable tolerances.</span>
        </div>
      ) : (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                {['Trade ID', 'Contracted (kWh)', 'Delivered (kWh)', 'Shortfall %', 'Audit Status', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {disputes.map(d => (
                <React.Fragment key={d.id}>
                  <tr>
                    <td className="font-mono text-xs font-bold">{d.trade_id.substring(0, 16)}…</td>
                    <td className="text-sm font-semibold">{Number(d.contracted_kwh).toFixed(2)} kWh</td>
                    <td className="text-sm font-bold" style={{ color: d.trade_status === 'SETTLED' ? 'inherit' : 'var(--color-danger)' }}>
                      {Number(d.delivered_kwh || 0).toFixed(2)} kWh
                    </td>
                    <td className="text-sm font-semibold">
                      <span className="badge badge-danger">{Number(d.shortfall_percent).toFixed(1)}%</span>
                    </td>
                    <td>
                      {d.trade_status === 'SETTLED' ? (
                        <span className="badge badge-success">✓ Resolved</span>
                      ) : (
                        <span className="badge badge-warning">⚠ Action Required</span>
                      )}
                    </td>
                    <td>
                      {d.trade_status !== 'SETTLED' && resolvingId !== d.trade_id && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleResolveClick(d)}>
                          Resolve Dispute
                        </button>
                      )}
                    </td>
                  </tr>

                  {resolvingId === d.trade_id && (
                    <tr>
                      <td colSpan="6" className="p-4 bg-slate-50 border-b">
                        <form onSubmit={(e) => handleResolveSubmit(e, d.trade_id)} className="card bg-white p-4 flex flex-col gap-4 border border-[#e2dcd5]">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-1">
                            <AlertTriangle size={16} color="var(--color-warning)" /> Dispute Settlement Parameters
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                              <label>Resolution Notes</label>
                              <input
                                type="text"
                                required
                                value={resolutionData.resolution}
                                onChange={(e) => setResolutionData({...resolutionData, resolution: e.target.value})}
                              />
                            </div>
                            <div>
                              <label>Refund Amount ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={resolutionData.refund_amount}
                                onChange={(e) => setResolutionData({...resolutionData, refund_amount: e.target.value})}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2 border-t">
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => setResolvingId(null)}>Cancel</button>
                            <button type="submit" className="btn btn-primary btn-sm"><CheckCircle size={14} /> Finalize Resolution</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
