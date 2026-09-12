import React, { useEffect, useState } from 'react';
import { Settings, Save, AlertCircle, Cpu, Sliders, CheckCircle } from 'lucide-react';
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
      toast.success('Deposit approved! Funds credited to user wallet and recorded on ledger.');
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
      fetchZones();
    } catch (err) {
      toast.error(err.toString());
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card text-center p-12 text-muted">Loading platform settings…</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <Settings size={24} color="var(--color-primary)" />
            <h1 className="mb-0">Platform & Grid Setup</h1>
          </div>
          <p className="text-sm text-muted mb-0 mt-1">Configure microgrid hardware thresholds, dynamic pricing parameters, & wallet deposits</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-12">
        {/* Left Column: Grid Zones */}
        <div className="col-span-1">
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b bg-white flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">Grid Zone Hardware List</span>
              <span className="badge badge-neutral text-xs">{zones.length} Zones</span>
            </div>
            <div className="flex flex-col">
              {zones.map(z => (
                <button
                  key={z.id}
                  onClick={() => handleSelectZone(z)}
                  className={`p-4 border-b text-left flex items-center justify-between transition-colors bg-transparent border-0 cursor-pointer ${selectedZone?.id === z.id ? 'bg-[#fcf3ed] border-l-4 border-l-[#8c5638]' : 'hover:bg-slate-50'}`}
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-900">{z.name}</div>
                    <div className="text-xs text-muted font-mono">{z.id}</div>
                  </div>
                  <span className={`badge ${z.status === 'NORMAL' ? 'badge-success' : 'badge-danger'}`}>{z.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Zone Form */}
        <div className="col-span-2">
          {selectedZone && pricingConfig ? (
            <div className="card">
              <div className="flex items-center justify-between mb-6 pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Cpu size={20} color="var(--color-primary)" />
                  <h2 className="m-0 text-lg">Configure Hardware & Pricing — {selectedZone.name}</h2>
                </div>
                <span className="badge badge-neutral">{selectedZone.status}</span>
              </div>
              
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4 pb-2 border-b">Hardware Capacity & Load Limits</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label>Max Grid Capacity (kW)</label>
                      <input type="number" step="0.1" name="capacity_kw" value={formData.capacity_kw} onChange={handleChange} required />
                    </div>
                    <div>
                      <label>Congestion Threshold (kW)</label>
                      <input type="number" step="0.1" name="congestion_threshold" value={formData.congestion_threshold} onChange={handleChange} required />
                      <p className="text-xs text-muted mt-1">Triggers dynamic pricing multiplier when load reaches threshold.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4 pb-2 border-b">Dynamic Pricing Formulas</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label>Floor Price ($/kWh)</label>
                      <input type="number" step="0.01" name="floor_price" value={formData.floor_price} onChange={handleChange} required />
                    </div>
                    <div>
                      <label>Ceiling Price ($/kWh)</label>
                      <input type="number" step="0.01" name="ceiling_price" value={formData.ceiling_price} onChange={handleChange} required />
                    </div>
                    <div className="col-span-2">
                      <label>Price Elasticity Factor</label>
                      <input type="number" step="0.1" name="elasticity_factor" value={formData.elasticity_factor} onChange={handleChange} required />
                      <p className="text-xs text-muted mt-1">Controls sensitivity of price fluctuations relative to net surplus vs demand ratio.</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <button type="submit" disabled={saving} className="btn btn-primary">
                    <Save size={15} /> {saving ? 'Saving Changes…' : 'Save Zone Parameters'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card text-center p-12 text-muted flex flex-col items-center justify-center min-h-64">
              <Sliders size={40} color="var(--color-text-muted)" className="mb-3" style={{ opacity: 0.5 }} />
              <p className="text-sm font-semibold mb-0">Select a grid zone from the left panel to configure hardware thresholds and rate rules.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Deposits Table */}
      <div>
        <h2 className="text-lg font-bold mb-4">Pending Wallet Deposits Queue</h2>
        {deposits.length === 0 ? (
          <div className="card text-center p-8 text-muted">No pending deposit requests awaiting approval.</div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  {['User Name & Email', 'Role', 'Deposit Amount ($)', 'Request Date', 'Status', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deposits.map(d => (
                  <tr key={d.id}>
                    <td>
                      <div className="font-semibold text-sm">{d.name}</div>
                      <div className="text-xs text-muted">{d.email}</div>
                    </td>
                    <td><span className="badge badge-neutral">{d.role}</span></td>
                    <td className="font-bold text-primary">${Number(d.amount).toFixed(2)}</td>
                    <td className="text-xs text-muted font-mono">{new Date(d.created_at).toLocaleString()}</td>
                    <td><span className={`badge ${d.status === 'PENDING' ? 'badge-warning' : 'badge-success'}`}>{d.status}</span></td>
                    <td>
                      {d.status === 'PENDING' && (
                        <button className="btn btn-sm btn-approve" onClick={() => handleApproveDeposit(d.id)}>
                          <CheckCircle size={12} /> Approve & Credit
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
