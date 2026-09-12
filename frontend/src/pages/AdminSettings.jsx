import React, { useEffect, useState } from 'react';
import { Settings, Save, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';

export default function AdminSettings() {
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [pricingConfig, setPricingConfig] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    capacity_kw: '',
    congestion_threshold: '',
    floor_price: '',
    ceiling_price: '',
    elasticity_factor: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deposits, setDeposits] = useState([]);

  const fetchZones = async () => {
    try {
      const data = await api.getZones();
      setZones(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDeposits = async () => {
    try {
      const data = await api.getDeposits();
      setDeposits(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([fetchZones(), fetchDeposits()]).finally(() => setLoading(false));
  }, []);

  const handleApproveDeposit = async (id) => {
    try {
      await api.approveDeposit(id);
      toast.success('Deposit approved! Funds minted to user wallet and recorded on ledger.');
      fetchDeposits();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  const handleSelectZone = async (zone) => {
    setSelectedZone(zone);
    setPricingConfig(null);
    try {
      const config = await api.getPricingConfig(zone.id);
      setPricingConfig(config);
      setFormData({
        capacity_kw: zone.capacity_kw,
        congestion_threshold: zone.congestion_threshold,
        floor_price: config.floor_price,
        ceiling_price: config.ceiling_price,
        elasticity_factor: config.elasticity_factor
      });
    } catch (err) {
      toast.error('Failed to load pricing config for this zone');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all([
        api.updateZone(selectedZone.id, {
          capacity_kw: Number(formData.capacity_kw),
          congestion_threshold: Number(formData.congestion_threshold)
        }),
        api.updatePricingConfig(selectedZone.id, {
          floor_price: Number(formData.floor_price),
          ceiling_price: Number(formData.ceiling_price),
          elasticity_factor: Number(formData.elasticity_factor)
        })
      ]);
      toast.success('Platform configuration updated successfully!');
      fetchZones(); // Refresh zones list
    } catch (err) {
      toast.error(err.toString());
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading platform settings...</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        <Settings size={28} color="var(--color-primary-dark)" />
        <h1 style={{ margin: 0 }}>Platform Setup</h1>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-1">
          <div className="card" style={{ padding: 0 }}>
            <h3 className="p-4 mb-0 border-b" style={{ borderBottom: '1px solid var(--color-border)' }}>Grid Zones</h3>
            <div className="flex-col flex">
              {zones.map(z => (
                <button
                  key={z.id}
                  onClick={() => handleSelectZone(z)}
                  style={{
                    padding: '16px',
                    textAlign: 'left',
                    background: selectedZone?.id === z.id ? '#e3f2fd' : 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    fontWeight: selectedZone?.id === z.id ? 700 : 500
                  }}
                >
                  <div className="text-sm">{z.name}</div>
                  <div className="text-xs text-muted">{z.id}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          {selectedZone && pricingConfig ? (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 style={{ margin: 0 }}>Configure {selectedZone.name}</h2>
                <span className="badge badge-neutral">{selectedZone.status}</span>
              </div>
              
              <form onSubmit={handleSubmit} className="grid gap-6">
                
                {/* Zone Settings */}
                <div>
                  <h3 className="text-sm font-bold text-muted mb-4 border-b pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>Grid Hardware Limits</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold block mb-1">Max Capacity (kWh)</label>
                      <input type="number" step="0.1" name="capacity_kw" value={formData.capacity_kw} onChange={handleChange} required />
                    </div>
                    <div>
                      <label className="text-sm font-bold block mb-1">Congestion Threshold (kWh)</label>
                      <input type="number" step="0.1" name="congestion_threshold" value={formData.congestion_threshold} onChange={handleChange} required />
                      <p className="text-xs text-muted mt-1">If load exceeds this, the grid is marked CONSTRAINED.</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Rules */}
                <div>
                  <h3 className="text-sm font-bold text-muted mb-4 border-b pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>Dynamic Pricing Rules</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold block mb-1">Floor Price ($/kWh)</label>
                      <input type="number" step="0.01" name="floor_price" value={formData.floor_price} onChange={handleChange} required />
                    </div>
                    <div>
                      <label className="text-sm font-bold block mb-1">Ceiling Price ($/kWh)</label>
                      <input type="number" step="0.01" name="ceiling_price" value={formData.ceiling_price} onChange={handleChange} required />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-bold block mb-1">Price Elasticity Factor</label>
                      <input type="number" step="0.1" name="elasticity_factor" value={formData.elasticity_factor} onChange={handleChange} required />
                      <p className="text-xs text-muted mt-1">Higher factor makes the price swing faster as demand outpaces supply.</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-4 pt-4 border-t" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <button type="submit" disabled={saving} className="btn btn-primary flex items-center gap-2">
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card text-center p-8 text-muted flex-col items-center justify-center flex" style={{ height: '100%' }}>
              <AlertCircle size={48} color="var(--color-border)" className="mb-4" />
              <p>Select a grid zone from the left to configure its hardware limits and dynamic pricing rules.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4">Pending Wallet Deposits</h2>
        {deposits.length === 0 ? (
          <div className="card text-center p-8 text-muted">No pending deposits.</div>
        ) : (
          <div className="card table-responsive" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th className="p-4 text-left text-sm font-bold">User</th>
                  <th className="p-4 text-left text-sm font-bold">Role</th>
                  <th className="p-4 text-left text-sm font-bold">Amount</th>
                  <th className="p-4 text-left text-sm font-bold">Date</th>
                  <th className="p-4 text-left text-sm font-bold">Status</th>
                  <th className="p-4 text-right text-sm font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="p-4">
                      <div>{d.name}</div>
                      <div className="text-xs text-muted">{d.email}</div>
                    </td>
                    <td className="p-4">{d.role}</td>
                    <td className="p-4 font-bold">${Number(d.amount).toFixed(2)}</td>
                    <td className="p-4">{new Date(d.created_at).toLocaleString()}</td>
                    <td className="p-4"><span className={`badge ${d.status === 'PENDING' ? 'badge-danger' : 'badge-success'}`}>{d.status}</span></td>
                    <td className="p-4 text-right">
                      {d.status === 'PENDING' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleApproveDeposit(d.id)}>
                          Approve & Mint
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
