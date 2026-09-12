import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle } from 'lucide-react';
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
      resolution: dispute.resolution || 'Resolved by Admin after review.',
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
      toast.success('Dispute resolved on the blockchain ledger.');
      setResolvingId(null);
      fetchDisputes();
    } catch (err) {
      toast.error('Error resolving dispute: ' + err.message);
    }
  };

  if (loading) return <div>Loading disputes...</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        <ShieldAlert size={28} color="var(--color-danger)" />
        <h1 style={{ margin: 0 }}>Disputes Management</h1>
      </div>
      
      {disputes.length === 0 ? (
        <div className="card text-center p-8 text-muted">
          No disputed trades found in the system.
        </div>
      ) : (
        <div className="card table-responsive" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th className="p-4 text-left text-sm font-bold">Trade ID</th>
                <th className="p-4 text-left text-sm font-bold">Contracted</th>
                <th className="p-4 text-left text-sm font-bold">Delivered</th>
                <th className="p-4 text-left text-sm font-bold">Shortfall %</th>
                <th className="p-4 text-left text-sm font-bold">Status</th>
                <th className="p-4 text-right text-sm font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map(d => (
                <React.Fragment key={d.id}>
                  <tr style={{ borderBottom: resolvingId === d.trade_id ? 'none' : '1px solid var(--color-border)', backgroundColor: d.trade_status === 'SETTLED' ? 'var(--color-bg)' : 'white' }}>
                    <td className="p-4 font-monospace text-sm">{d.trade_id.substring(0, 8)}...</td>
                    <td className="p-4">{Number(d.contracted_kwh).toFixed(2)} kWh</td>
                    <td className="p-4 font-bold" style={{ color: d.trade_status === 'SETTLED' ? 'inherit' : 'var(--color-danger)' }}>
                      {Number(d.delivered_kwh || 0).toFixed(2)} kWh
                    </td>
                    <td className="p-4">
                      {Number(d.shortfall_percent).toFixed(1)}%
                    </td>
                    <td className="p-4">
                      {d.trade_status === 'SETTLED' ? (
                        <span className="badge badge-success">Resolved</span>
                      ) : (
                        <span className="badge badge-danger">Action Required</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {d.trade_status !== 'SETTLED' && resolvingId !== d.trade_id && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleResolveClick(d)}>
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                  {resolvingId === d.trade_id && (
                    <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: '#fdfdfd' }}>
                      <td colSpan="6" className="p-4">
                        <form onSubmit={(e) => handleResolveSubmit(e, d.trade_id)} className="flex flex-wrap-responsive items-end gap-4 p-4 border rounded" style={{ borderColor: 'var(--color-border)' }}>
                          <div className="flex-1">
                            <label className="text-sm font-bold block mb-1">Resolution Notes</label>
                            <input 
                              type="text" 
                              required 
                              value={resolutionData.resolution}
                              onChange={(e) => setResolutionData({...resolutionData, resolution: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-bold block mb-1">Refund Amount ($)</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              required 
                              value={resolutionData.refund_amount}
                              onChange={(e) => setResolutionData({...resolutionData, refund_amount: e.target.value})}
                            />
                          </div>
                          <button type="submit" className="btn btn-primary flex items-center gap-2">
                            <CheckCircle size={16} /> Finalize Resolution
                          </button>
                          <button type="button" className="btn btn-outline" onClick={() => setResolvingId(null)}>
                            Cancel
                          </button>
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
