import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';
import EnergyCard from '../components/EnergyCard';
import { Zap, Activity, ShieldAlert, BarChart3 } from 'lucide-react';

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div>Loading dashboard...</div>;
  if (!data) return <div>Failed to load data</div>;

  // Admin users have a dedicated dashboard
  if (user.role === 'admin') {
    return (
      <div className="p-8 text-center">
        <p className="text-muted mb-4">You are logged in as Admin.</p>
        <a href="/admin/dashboard" className="btn btn-primary">Go to Admin Dashboard →</a>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 'var(--spacing-8)' }}>Welcome, {user.name}</h1>
      
      {user.role === 'prosumer' && (
        <div className="grid grid-cols-4 gap-6">
          <EnergyCard title="Wallet Balance" value={Number(data.wallet_balance).toFixed(2)} unit="USD" icon={Zap} />
          <EnergyCard title="Current Surplus" value={Number(data.current_surplus_kwh || 0).toFixed(2)} unit="kWh" icon={Zap} />
          <EnergyCard title="Committed Energy" value={Number(data.already_committed_quantity || 0).toFixed(2)} unit="kWh" icon={Activity} />
          <EnergyCard title="Eligible Sellable Energy" value={Number(data.available_sellable_energy || 0).toFixed(2)} unit="kWh" icon={Activity} />
          <EnergyCard title="Today's Generation" value={Number(data.today_generation_kwh || 0).toFixed(2)} unit="kWh" icon={Zap} />
          <EnergyCard title="Today's Consumption" value={Number(data.today_consumption_kwh || 0).toFixed(2)} unit="kWh" icon={Activity} />
          <EnergyCard title="Active Trades" value={data.trades?.filter(t => ['MATCHED', 'LOCKED', 'DELIVERED'].includes(t.status))?.length || 0} unit="" icon={BarChart3} />
          <EnergyCard title="Settled Amount" value={Number(data.settled_amount || 0).toFixed(2)} unit="USD" icon={Zap} />
          
          {data.meter_id && (
            <div className="col-span-4 mb-2">
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
                <Zap size={16} className="inline mr-2" />
                Simulate Energy Generation (IoT)
              </button>
            </div>
          )}
          
          {data.assets?.length > 0 && data.available_sellable_energy > 0 && (
            <div className="card col-span-2 mt-4" style={{ border: '2px solid var(--color-secondary)' }}>
              <h2 className="mb-4">Sell Energy</h2>
              <p className="text-sm text-muted mb-4">You have {Number(data.available_sellable_energy).toFixed(2)} kWh of eligible surplus energy available to sell.</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const fd = new FormData(e.target);
                  const qty = Number(fd.get('quantity_kwh'));
                  const price = Number(fd.get('asking_price'));
                  await api.createListing({ quantity_kwh: qty, asking_price: price });
                  toast.success('Energy offer created successfully!');
                  setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                  toast.error(err.toString());
                }
              }} className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold block mb-1">Quantity to Sell (kWh)</label>
                    <input type="number" step="0.1" name="quantity_kwh" max={data.available_sellable_energy} placeholder="e.g. 10.0" required />
                  </div>
                  <div>
                    <label className="text-sm font-bold block mb-1">Desired Selling Price ($/kWh)</label>
                    <input type="number" step="0.01" name="asking_price" placeholder="e.g. 0.15" required />
                  </div>
                </div>
                <div className="mt-2">
                  <button type="submit" className="btn btn-primary w-full">Create Energy Offer</button>
                </div>
              </form>
            </div>
          )}
          
          {data.assets?.length > 0 && data.listings?.filter(l => l.status === 'ACTIVE').length > 0 && (
            <div className="card col-span-2 mt-4">
              <h2 className="mb-4">Active Energy Offers</h2>
              <div className="flex flex-col gap-4">
                {data.listings.filter(l => l.status === 'ACTIVE').map(l => (
                  <div key={l.id} className="p-4 border rounded" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-bold text-lg">{Number(l.remaining_kwh).toFixed(2)} kWh @ ${Number(l.asking_price).toFixed(2)}/kWh</div>
                      <span className="badge badge-success">ACTIVE</span>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <button className="btn btn-outline btn-sm" onClick={() => {
                        const newPrice = prompt('Enter new asking price ($/kWh):', l.asking_price);
                        if (newPrice && !isNaN(newPrice)) {
                          api.updateListing(l.id, { asking_price: Number(newPrice) })
                            .then(() => { toast.success('Offer updated'); window.location.reload(); })
                            .catch(err => toast.error(err.toString()));
                        }
                      }}>Edit Price</button>
                      <button className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => {
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
            <div className="card col-span-4 mt-4" style={{ border: '2px solid var(--color-primary-light)' }}>
              <h2 className="mb-4">⚡ Onboard Your Solar Asset</h2>
              <p className="text-sm text-muted mb-6">You need to register your solar panels and link a smart meter before you can start trading energy.</p>
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
                  toast.success('Asset and Smart Meter linked successfully! Energy generation will begin shortly.');
                  setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                  toast.error(err.toString());
                }
              }} className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold block mb-1">Capacity (kW)</label>
                    <input type="number" step="0.1" name="capacity_kw" placeholder="e.g. 5.0" required />
                  </div>
                  <div>
                    <label className="text-sm font-bold block mb-1">Panel Details</label>
                    <input type="text" name="panel_details" placeholder="e.g. SunPower 400W x 10" required />
                  </div>
                  <div>
                    <label className="text-sm font-bold block mb-1">Inverter Details</label>
                    <input type="text" name="inverter_details" placeholder="e.g. SolarEdge SE5000H" required />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input type="checkbox" name="battery_enabled" id="battery_enabled" />
                    <label htmlFor="battery_enabled" className="text-sm font-bold m-0 cursor-pointer">Battery Storage Installed</label>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                  <button type="submit" className="btn btn-primary">Link Smart Meter & Start Trading</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {user.role === 'consumer' && (
        <div className="grid grid-cols-4 gap-6">
          <EnergyCard title="Wallet Balance" value={data.wallet_balance} unit="USD" icon={Zap} />
          <EnergyCard title="Active Orders" value={data.orders?.filter(o => o.status === 'OPEN')?.length || 0} unit="open" icon={Activity} />
          <EnergyCard title="Active Trades" value={data.trades?.filter(t => ['MATCHED', 'LOCKED', 'DELIVERED'].includes(t.status))?.length || 0} unit="locked" icon={Zap} />
          <EnergyCard title="Lifetime Consumed" value={data.trades?.reduce((acc, t) => acc + (['SETTLED','VERIFIED'].includes(t.status) ? Number(t.quantity_kwh) : 0), 0) || 0} unit="kWh" icon={BarChart3} />
          
          <div className="col-span-4 mb-4">
            <button className="btn btn-outline btn-sm" onClick={() => {
              const amount = prompt('Enter amount to deposit (USD):');
              if (amount && !isNaN(amount)) {
                api.requestDeposit({ amount: Number(amount) })
                  .then(() => toast.success('Deposit requested! Waiting for admin approval.'))
                  .catch(err => toast.error(err.toString()));
              }
            }}>
              + Request Deposit
            </button>
          </div>
        </div>
      )}

      {(user.role === 'admin' || user.role === 'utility') && (
        <>
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="card">
              <h3 className="text-sm font-bold text-muted">Market State</h3>
              <div className="font-bold text-lg mt-2">{data.trades?.length} Lifetime Trades</div>
            </div>
            
            <div className="card">
              <h3 className="text-sm font-bold text-muted flex items-center gap-2">
                Ledger Integrity <ShieldAlert size={16} color={data.ledger_valid?.valid ? "var(--color-success)" : "var(--color-danger)"} />
              </h3>
              <div className="font-bold text-lg mt-2" style={{ color: data.ledger_valid?.valid ? "var(--color-success)" : "var(--color-danger)" }}>
                {data.ledger_valid?.valid ? 'Valid (Cryptographically Verified)' : 'Invalid (Tampering Detected)'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
