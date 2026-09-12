import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from '../utils/toast';
import EnergyCard from '../components/EnergyCard';
import UtilityDashboard from './UtilityDashboard';
import RegulatorDashboard from './RegulatorDashboard';
import { Zap, Activity, ShieldAlert, BarChart3, PlusCircle, ArrowUpRight } from 'lucide-react';

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Admin users should be seamlessly redirected to their dedicated admin dashboard
  if (user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Utility Companies & Grid Operators get dedicated Grid Operator Console
  if (user?.role === 'utility') {
    return <UtilityDashboard user={user} />;
  }

  // Energy Regulators get dedicated Platform Compliance & Audit Hub
  if (user?.role === 'regulator') {
    return <RegulatorDashboard user={user} />;
  }


  useEffect(() => {
    const fetchDash = async () => {
      try {
        let res;
        if (user.role === 'prosumer') {
          res = await api.getProsumerDashboard();
        } else if (user.role === 'consumer') {
          res = await api.getConsumerDashboard();
        } else {
          res = await api.getRegulatorDashboard();
        }
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDash();
  }, [user]);

  if (loading) return <div className="card text-center p-12 text-muted">Loading user dashboard…</div>;
  if (!data) return <div className="card text-center p-12 text-muted">Failed to load dashboard data.</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b">
        <div>
          <h1 className="mb-0">Welcome back, {user.name}</h1>
          <p className="text-sm text-muted mb-0 mt-1">Role: <b className="capitalize">{user.role}</b> • Account Status: <span className="badge badge-success">ACTIVE</span></p>
        </div>
        
        {data.meter_id && user.role === 'prosumer' && (
          <button className="btn btn-primary" onClick={async () => {
            try {
              toast.success('Simulating IoT reading...');
              await api.simulateMeter(data.meter_id);
              toast.success('Energy generation simulated successfully!');
              setTimeout(() => window.location.reload(), 1000);
            } catch(err) {
              toast.error(err.response?.data?.message || err.toString());
            }
          }}>
            <Zap size={16} /> Simulate IoT Generation
          </button>
        )}
      </div>
      
      {/* Prosumer Dashboard */}
      {user.role === 'prosumer' && (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-4 gap-5">
            <EnergyCard title="Wallet Balance" value={`$${Number(data.wallet_balance).toFixed(2)}`} unit="USD" icon={Zap} />
            <EnergyCard title="Current Surplus" value={Number(data.current_surplus_kwh || 0).toFixed(2)} unit="kWh" icon={Zap} />
            <EnergyCard title="Committed Energy" value={Number(data.already_committed_quantity || 0).toFixed(2)} unit="kWh" icon={Activity} />
            <EnergyCard title="Eligible Sellable Energy" value={Number(data.available_sellable_energy || 0).toFixed(2)} unit="kWh" icon={Activity} />
            <EnergyCard title="Today's Generation" value={Number(data.today_generation_kwh || 0).toFixed(2)} unit="kWh" icon={Zap} />
            <EnergyCard title="Today's Consumption" value={Number(data.today_consumption_kwh || 0).toFixed(2)} unit="kWh" icon={Activity} />
            <EnergyCard title="Active Trades" value={data.trades?.filter(t => ['MATCHED', 'LOCKED', 'DELIVERED'].includes(t.status))?.length || 0} unit="trades" icon={BarChart3} />
            <EnergyCard title="Settled Earnings" value={`$${Number(data.settled_amount || 0).toFixed(2)}`} unit="USD" icon={Zap} />
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {data.assets?.length > 0 && data.available_sellable_energy > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                  <ArrowUpRight size={20} color="var(--color-primary)" />
                  <h2 className="m-0 text-lg">Create Energy Offer</h2>
                </div>
                <p className="text-sm text-muted mb-4">You have <b>{Number(data.available_sellable_energy).toFixed(2)} kWh</b> of eligible surplus energy available to list on the marketplace.</p>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const fd = new FormData(e.target);
                    const qty = Number(fd.get('quantity_kwh'));
                    const price = Number(fd.get('asking_price'));
                    await api.createListing({ quantity_kwh: qty, asking_price: price });
                    toast.success('Energy offer created successfully!');
                    setTimeout(() => window.location.reload(), 1200);
                  } catch (err) {
                    toast.error(err.toString());
                  }
                }} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label>Quantity to Sell (kWh)</label>
                      <input type="number" step="0.1" name="quantity_kwh" max={data.available_sellable_energy} placeholder="e.g. 10.0" required />
                    </div>
                    <div>
                      <label>Desired Price ($/kWh)</label>
                      <input type="number" step="0.01" name="asking_price" placeholder="e.g. 0.15" required />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary w-full mt-2">Publish Offer to Marketplace</button>
                </form>
              </div>
            )}
            
            {data.assets?.length > 0 && data.listings?.filter(l => l.status === 'ACTIVE').length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-4 pb-2 border-b">
                  <h2 className="m-0 text-lg">Active Energy Offers</h2>
                  <span className="badge badge-success">{data.listings.filter(l => l.status === 'ACTIVE').length} Active</span>
                </div>
                <div className="flex flex-col gap-3">
                  {data.listings.filter(l => l.status === 'ACTIVE').map(l => (
                    <div key={l.id} className="p-4 border rounded-lg bg-slate-50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-base text-slate-900">{Number(l.remaining_kwh).toFixed(2)} kWh @ <span className="text-primary">${Number(l.asking_price).toFixed(2)}/kWh</span></div>
                        <div className="text-xs text-muted font-mono">{new Date(l.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn btn-outline btn-sm" onClick={() => {
                          const newPrice = prompt('Enter new asking price ($/kWh):', l.asking_price);
                          if (newPrice && !isNaN(newPrice)) {
                            api.updateListing(l.id, { asking_price: Number(newPrice) })
                              .then(() => { toast.success('Offer updated'); window.location.reload(); })
                              .catch(err => toast.error(err.toString()));
                          }
                        }}>Edit Rate</button>
                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)', borderColor: '#fecdd3' }} onClick={() => {
                          if (window.confirm('Are you sure you want to cancel this offer?')) {
                            api.cancelListing(l.id)
                              .then(() => { toast.success('Offer cancelled'); window.location.reload(); })
                              .catch(err => toast.error(err.toString()));
                          }
                        }}>Cancel</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.assets?.length === 0 && (
              <div className="card col-span-2">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                  <PlusCircle size={22} color="var(--color-primary)" />
                  <h2 className="m-0 text-lg">Onboard Solar Generation Hardware</h2>
                </div>
                <p className="text-sm text-muted mb-6">Register your solar panel details & link a smart meter to start generating surplus energy.</p>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const fd = new FormData(e.target);
                    const payload = {
                      capacity_kw: Number(fd.get('capacity_kw')),
                      panel_details: fd.get('panel_details'),
                      inverter_details: fd.get('inverter_details'),
                      battery_enabled: fd.get('battery_enabled') === 'on'
                    };
                    const asset = await api.createAsset(payload);
                    await api.createMeter(asset.id);
                    toast.success('Asset & Smart Meter linked! Energy simulation ready.');
                    setTimeout(() => window.location.reload(), 1200);
                  } catch (err) {
                    toast.error(err.toString());
                  }
                }} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label>Capacity (kW)</label>
                      <input type="number" step="0.1" name="capacity_kw" placeholder="e.g. 5.0" required />
                    </div>
                    <div>
                      <label>Panel Details</label>
                      <input type="text" name="panel_details" placeholder="e.g. SunPower 400W x 10" required />
                    </div>
                    <div>
                      <label>Inverter Specifications</label>
                      <input type="text" name="inverter_details" placeholder="e.g. SolarEdge SE5000H" required />
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <input type="checkbox" name="battery_enabled" id="battery_enabled" style={{ width: 'auto', margin: 0 }} />
                      <label htmlFor="battery_enabled" className="m-0 cursor-pointer text-sm">Battery Storage System Included</label>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <button type="submit" className="btn btn-primary">Link Smart Meter & Start Trading</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Consumer Dashboard */}
      {user.role === 'consumer' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-4 gap-5">
            <EnergyCard title="Wallet Balance" value={`$${Number(data.wallet_balance).toFixed(2)}`} unit="USD" icon={Zap} />
            <EnergyCard title="Active Orders" value={data.orders?.filter(o => o.status === 'OPEN')?.length || 0} unit="open" icon={Activity} />
            <EnergyCard title="Active Trades" value={data.trades?.filter(t => ['MATCHED', 'LOCKED', 'DELIVERED'].includes(t.status))?.length || 0} unit="locked" icon={Zap} />
            <EnergyCard title="Lifetime Consumed" value={data.trades?.reduce((acc, t) => acc + (['SETTLED','VERIFIED'].includes(t.status) ? Number(t.quantity_kwh) : 0), 0) || 0} unit="kWh" icon={BarChart3} />
          </div>

          <div className="card flex items-center justify-between">
            <div>
              <h3 className="m-0 text-base font-bold">Add Funds to Consumer Wallet</h3>
              <p className="text-xs text-muted mb-0 mt-1">Request a deposit to purchase P2P solar energy on the marketplace.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => {
              const amount = prompt('Enter deposit amount ($ USD):');
              if (amount && !isNaN(amount)) {
                api.requestDeposit({ amount: Number(amount) })
                  .then(() => toast.success('Deposit request submitted for admin review.'))
                  .catch(err => toast.error(err.toString()));
              }
            }}>
              + Request Deposit
            </button>
          </div>
        </div>
      )}

      {(user.role === 'regulator' || user.role === 'utility') && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2">Market Overview</h3>
            <div className="text-2xl font-bold text-slate-900">{data.trades?.length} Total Platform Trades</div>
          </div>
          <div className="card">
            <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              Cryptographic Ledger Status <ShieldAlert size={16} color={data.ledger_valid?.valid ? "var(--color-success)" : "var(--color-danger)"} />
            </h3>
            <div className="text-lg font-bold" style={{ color: data.ledger_valid?.valid ? "var(--color-success)" : "var(--color-danger)" }}>
              {data.ledger_valid?.valid ? '✓ SHA-256 Chain Intact' : '✗ Tamper Warning'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
