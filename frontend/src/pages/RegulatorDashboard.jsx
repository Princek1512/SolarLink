import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';
import EnergyCard from '../components/EnergyCard';
import { ShieldCheck, Flag, AlertCircle, Scale, FileText, CheckCircle2, RefreshCw, Eye, Lock } from 'lucide-react';

export default function RegulatorDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flagModalTrade, setFlagModalTrade] = useState(null);

  const fetchRegulatorData = async () => {
    try {
      setLoading(true);
      const res = await api.getRegulatorDashboard();
      setData(res);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegulatorData();
  }, []);

  const handleFlagTrade = async (e) => {
    e.preventDefault();
    if (!flagModalTrade) return;
    const fd = new FormData(e.target);
    const note = fd.get('compliance_note');

    try {
      await api.flagTrade(flagModalTrade.id, { compliance_note: note });
      toast.success(`Trade ${flagModalTrade.id.substring(0, 8)}... flagged for regulatory review.`);
      setFlagModalTrade(null);
      fetchRegulatorData();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  if (loading) return <div className="card text-center p-12 text-muted">Loading Regulator Compliance Console…</div>;
  if (!data) return <div className="card text-center p-12 text-muted">Failed to load regulator compliance data.</div>;

  return (
    <div className="flex flex-col gap-8">
      {/* Regulator Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-neutral uppercase font-mono tracking-wider">Energy Regulator</span>
            <span className="badge badge-success">Platform Compliance & Audit Hub</span>
          </div>
          <h1 className="mt-2 mb-1 text-2xl font-bold">Independent Compliance & Market Manipulation Auditor</h1>
          <p className="text-sm text-muted">Platform-wide oversight for pricing fairness, transaction auditability, dispute logs, and ledger integrity.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold">
            <Lock size={14} /> Read-Only Compliance Access
          </div>
          <button onClick={fetchRegulatorData} className="btn btn-outline flex items-center gap-2">
            <RefreshCw size={16} /> Refresh Metrics
          </button>
        </div>
      </div>

      {/* Top High-Level Metrics */}
      <div className="grid grid-cols-4 gap-5">
        <EnergyCard title="Total Platform Volume" value={data.total_volume_kwh?.toFixed(1)} unit="kWh" icon={Scale} />
        <EnergyCard title="P2P Transaction Value" value={`$${data.total_value_usd?.toFixed(2)}`} unit="USD" icon={Scale} />
        <EnergyCard title="Compliance Flagged Trades" value={data.flagged_count} unit="flagged" icon={Flag} />
        <EnergyCard title="Dispute Resolution Logs" value={data.disputes_count} unit="disputes" icon={FileText} />
      </div>

      {/* Cryptographic SHA-256 Ledger Banner */}
      <div className={`p-4 border rounded-xl flex items-center justify-between ${
        data.ledger_valid?.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-red-50 border-red-200 text-red-950'
      }`}>
        <div className="flex items-center gap-3">
          <ShieldCheck size={26} color={data.ledger_valid?.valid ? '#059669' : '#dc2626'} />
          <div>
            <h3 className="m-0 text-base font-bold">Immutable SHA-256 Blockchain Ledger Status</h3>
            <p className="text-xs m-0 mt-0.5">
              {data.ledger_valid?.valid 
                ? `✓ Cryptographic Proof Intact: All trade events verified across ${data.total_trades} blockchain blocks.` 
                : '⚠️ Tamper Warning: Discrepancy detected in trade event hash chain!'}
            </p>
          </div>
        </div>
        <span className={`badge ${data.ledger_valid?.valid ? 'badge-success' : 'badge-danger'}`}>
          {data.ledger_valid?.valid ? 'PASSED AUDIT' : 'HASH MISMATCH'}
        </span>
      </div>

      {/* Pricing Fairness Analysis Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Scale size={20} color="var(--color-primary)" />
            <h2 className="m-0 text-lg font-bold">Pricing Fairness & Market Rate Benchmark</h2>
          </div>
          <span className="text-xs text-muted font-mono">Independent Benchmark</span>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="p-4 border rounded-xl bg-slate-50">
            <span className="text-xs text-muted font-bold uppercase tracking-wider block mb-1">P2P Average Trade Price</span>
            <div className="text-2xl font-bold text-slate-900">${data.avg_p2p_rate?.toFixed(4)} <span className="text-sm font-normal text-muted">/ kWh</span></div>
            <span className="text-xs text-emerald-700 font-semibold block mt-1">✓ Fair Market Benchmark</span>
          </div>

          <div className="p-4 border rounded-xl bg-slate-50">
            <span className="text-xs text-muted font-bold uppercase tracking-wider block mb-1">Utility Retail Grid Rate</span>
            <div className="text-2xl font-bold text-slate-900">${data.grid_retail_rate?.toFixed(4)} <span className="text-sm font-normal text-muted">/ kWh</span></div>
            <span className="text-xs text-emerald-700 font-semibold block mt-1">
              Consumers save <b>{data.consumer_savings_percent?.toFixed(1)}%</b> vs Grid Tariff
            </span>
          </div>

          <div className="p-4 border rounded-xl bg-slate-50">
            <span className="text-xs text-muted font-bold uppercase tracking-wider block mb-1">Utility Feed-in Buyback Rate</span>
            <div className="text-2xl font-bold text-slate-900">${data.feed_in_rate?.toFixed(4)} <span className="text-sm font-normal text-muted">/ kWh</span></div>
            <span className="text-xs text-emerald-700 font-semibold block mt-1">
              Prosumers earn <b>{data.prosumer_gain_percent?.toFixed(1)}%</b> higher returns
            </span>
          </div>
        </div>

        {/* Visual Benchmark Comparison Bar */}
        <div className="p-4 border rounded-xl bg-slate-100/70">
          <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
            <span>Buyback Feed-in Rate ($0.08)</span>
            <span className="text-primary font-extrabold">P2P Average (${data.avg_p2p_rate?.toFixed(3)})</span>
            <span>Utility Retail Rate ($0.22)</span>
          </div>
          <div className="w-full bg-slate-300 rounded-full h-4 relative overflow-hidden flex">
            <div className="bg-emerald-400 h-full" style={{ width: '36%' }} title="Utility Buyback Floor" />
            <div className="bg-amber-400 h-full" style={{ width: '32%' }} title="P2P Trading Spread" />
            <div className="bg-sky-400 h-full" style={{ width: '32%' }} title="Utility Retail Ceiling" />
          </div>
          <p className="text-xs text-muted m-0 mt-2 text-center">
            P2P market operates strictly within the fair price corridor between utility feed-in floor ($0.08) and retail grid ceiling ($0.22).
          </p>
        </div>
      </div>

      {/* Transaction History & Market Manipulation Flagging */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Flag size={20} color="var(--color-primary)" />
            <h2 className="m-0 text-lg font-bold">Transaction History & Market Manipulation Flagging</h2>
          </div>
          <span className="text-xs text-muted font-mono">{data.trades?.length} Total Recorded Trades</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600 uppercase font-semibold">
                <th className="p-3">Trade ID</th>
                <th className="p-3">Seller (Prosumer)</th>
                <th className="p-3">Buyer (Consumer)</th>
                <th className="p-3">Volume (kWh)</th>
                <th className="p-3">Price ($/kWh)</th>
                <th className="p-3">Total Value</th>
                <th className="p-3">Status</th>
                <th className="p-3">Compliance Flag</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.trades?.map(trade => {
                const isFlagged = trade.compliance_flagged;
                return (
                  <tr key={trade.id} className={`border-b hover:bg-slate-50/80 ${isFlagged ? 'bg-amber-50/50' : ''}`}>
                    <td className="p-3 font-mono font-bold text-slate-900">{trade.id.substring(0, 8)}...</td>
                    <td className="p-3 font-semibold">{trade.seller_name || trade.seller_id.substring(0, 8)}</td>
                    <td className="p-3 font-semibold">{trade.buyer_name || trade.buyer_id.substring(0, 8)}</td>
                    <td className="p-3 font-bold">{Number(trade.quantity_kwh).toFixed(2)} kWh</td>
                    <td className="p-3 font-bold text-primary">${Number(trade.agreed_price).toFixed(3)}</td>
                    <td className="p-3 font-bold">${(Number(trade.quantity_kwh) * Number(trade.agreed_price)).toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`badge ${trade.status === 'SETTLED' ? 'badge-success' : 'badge-neutral'}`}>
                        {trade.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {isFlagged ? (
                        <span className="badge badge-warning flex items-center gap-1" title={trade.compliance_note}>
                          <Flag size={10} /> FLAGGED: {trade.compliance_note || 'Inspection'}
                        </span>
                      ) : (
                        <span className="text-slate-400">Normal</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button 
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ borderColor: isFlagged ? '#d97706' : 'var(--color-gold)', color: isFlagged ? '#d97706' : 'var(--color-gold)' }}
                        onClick={() => setFlagModalTrade(trade)}
                      >
                        <Flag size={12} className="inline mr-1" /> {isFlagged ? 'Update Flag' : 'Flag Anomaly'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flagging Modal */}
      {flagModalTrade && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card shadow-lg" style={{ width: '460px', padding: '1.75rem', backgroundColor: '#ffffff' }}>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <Flag size={20} color="#d97706" />
              <h2 className="text-lg font-bold m-0">Flag Anomalous Pricing / Manipulation</h2>
            </div>
            <p className="text-xs text-muted mb-4">
              Trade ID: <b className="font-mono">{flagModalTrade.id}</b> • Price: <b>${flagModalTrade.agreed_price}/kWh</b>
            </p>

            <form onSubmit={handleFlagTrade} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold">Regulatory Compliance Note / Reason</label>
                <textarea 
                  name="compliance_note" 
                  rows={3}
                  placeholder="e.g. Unusual volume spike or price divergence detected beyond threshold"
                  defaultValue={flagModalTrade.compliance_note || ''}
                  required 
                />
              </div>

              <div className="flex gap-2 justify-end mt-4 pt-3 border-t">
                <button type="button" className="btn btn-outline" onClick={() => setFlagModalTrade(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Flag size={14} /> Submit Compliance Flag</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

