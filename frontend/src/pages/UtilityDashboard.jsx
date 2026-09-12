import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';
import EnergyCard from '../components/EnergyCard';
import { Zap, Activity, AlertTriangle, Radio, Power, RefreshCw, Sliders } from 'lucide-react';

export default function UtilityDashboard({ user }) {
  const [gridData, setGridData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pricingModalZone, setPricingModalZone] = useState(null);

  const fetchUtilityData = async () => {
    try {
      setLoading(true);
      const res = await api.getUtilityDashboard();
      setGridData(res);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load grid load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUtilityData();
  }, []);

  const handlePublishSignal = async (zoneId, statusLevel) => {
    try {
      await api.updateZone(zoneId, { status: statusLevel });
      toast.success(`Published '${statusLevel}' congestion signal for zone ${zoneId}`);
      fetchUtilityData();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  const handleToggleCurtailment = async (zoneId, currentCurtailment) => {
    try {
      const nextState = !currentCurtailment;
      await api.updateZone(zoneId, { curtailment_active: nextState, throttled: nextState });
      toast.success(`Grid Curtailment & Trade-Throttling ${nextState ? 'ACTIVATED' : 'DEACTIVATED'} for zone ${zoneId}`);
      fetchUtilityData();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  const handleUpdatePricing = async (e) => {
    e.preventDefault();
    if (!pricingModalZone) return;
    const fd = new FormData(e.target);
    const floor = parseFloat(fd.get('floor_price'));
    const ceiling = parseFloat(fd.get('ceiling_price'));
    const elasticity = parseFloat(fd.get('elasticity_factor'));

    try {
      await api.updatePricingConfig(pricingModalZone.id, { floor_price: floor, ceiling_price: ceiling, elasticity_factor: elasticity });
      toast.success(`Updated dynamic pricing parameters for ${pricingModalZone.name}`);
      setPricingModalZone(null);
      fetchUtilityData();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  if (loading) return <div className="card text-center p-12 text-muted">Loading Grid Operator Console…</div>;
  if (!gridData) return <div className="card text-center p-12 text-muted">Failed to fetch grid load data.</div>;

  return (
    <div className="flex flex-col gap-8">
      {/* Utility Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-neutral uppercase font-mono tracking-wider">Utility Company / Grid Operator</span>
            <span className="badge badge-success">Live Grid Monitor</span>
          </div>
          <h1 className="mt-2 mb-1 text-2xl font-bold">Grid Load & Congestion Management Console</h1>
          <p className="text-sm text-muted">Monitor feeder load per zone, publish dynamic congestion signals, and trigger trade curtailment in constrained zones.</p>
        </div>
        <button onClick={fetchUtilityData} className="btn btn-outline flex items-center gap-2">
          <RefreshCw size={16} /> Refresh Grid Status
        </button>
      </div>

      {/* Grid High-Level Cards */}
      <div className="grid grid-cols-4 gap-5">
        <EnergyCard title="Monitored Feeders / Zones" value={gridData.total_zones} unit="zones" icon={Radio} />
        <EnergyCard title="Constrained / Throttled" value={gridData.constrained_count} unit="zones" icon={AlertTriangle} />
        <EnergyCard title="Platform Active Meters" value={gridData.zones?.reduce((a, z) => a + (z.meter_count || 0), 0)} unit="meters" icon={Zap} />
        <EnergyCard title="Active P2P Offers" value={gridData.zones?.reduce((a, z) => a + (z.active_listings_count || 0), 0)} unit="offers" icon={Activity} />
      </div>

      {/* Grid Zones & Feeder Load Section */}
      <div className="flex flex-col gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <Radio size={20} color="var(--color-primary)" />
              <h2 className="m-0 text-lg font-bold">Grid Feeder Congestion & Load Monitor</h2>
            </div>
            <span className="text-xs text-muted font-mono">Real-time Telemetry</span>
          </div>

          <div className="flex flex-col gap-4">
            {gridData.zones?.map(zone => {
              const isCurtailed = zone.curtailment_active || zone.throttled;
              const isConstrained = zone.status === 'CONSTRAINED';
              const isElevated = zone.status === 'ELEVATED';

              return (
                <div 
                  key={zone.id}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '8px',
                    backgroundColor: isCurtailed ? '#fef2f2' : isConstrained ? '#fffbeb' : '#ffffff',
                    border: `1.5px solid ${isCurtailed ? '#fecaca' : isConstrained ? '#fde68a' : '#e2dcd5'}`,
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold m-0 text-slate-900">{zone.name}</h3>
                        <span className="text-xs font-mono text-muted">[{zone.id}]</span>
                      </div>
                      <p className="text-xs text-muted m-0 mt-1">
                        Connected Assets: <b>{zone.meter_count} meters</b> • P2P Volume: <b>{zone.active_listings_kwh.toFixed(1)} kWh</b>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCurtailed && (
                        <span className="badge" style={{ backgroundColor: '#b91c1c', color: '#ffffff' }}>
                          <Power size={12} className="inline mr-1" /> CURTAILED & THROTTLED
                        </span>
                      )}
                      <span className={`badge ${
                        isConstrained ? 'badge-danger' : isElevated ? 'badge-warning' : 'badge-success'
                      }`}>
                        {zone.status} SIGNAL
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar for Load */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                      <span>Current Load: <b>{zone.current_load_kw} kW</b> / Capacity: <b>{zone.capacity_kw} kW</b></span>
                      <span style={{ color: zone.utilization_percent > 85 ? '#b91c1c' : '#44403c', fontWeight: 700 }}>
                        {zone.utilization_percent}% Utilized
                      </span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '9999px', height: '10px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${Math.min(100, zone.utilization_percent)}%`,
                          backgroundColor: zone.utilization_percent > 85 ? '#b91c1c' : zone.utilization_percent > 65 ? '#d97706' : '#15803d',
                          transition: 'width 0.4s ease'
                        }} 
                      />
                    </div>
                  </div>

                  {/* Operator Controls Bar */}
                  <div className="pt-3 border-t flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 uppercase tracking-wider text-xs">Publish Signal:</span>
                      <button 
                        type="button"
                        className={`btn btn-xs ${zone.status === 'NORMAL' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => handlePublishSignal(zone.id, 'NORMAL')}
                      >
                        NORMAL
                      </button>
                      <button 
                        type="button"
                        className={`btn btn-xs ${zone.status === 'ELEVATED' ? 'btn-warning' : 'btn-outline'}`}
                        onClick={() => handlePublishSignal(zone.id, 'ELEVATED')}
                      >
                        ELEVATED
                      </button>
                      <button 
                        type="button"
                        className={`btn btn-xs ${zone.status === 'CONSTRAINED' ? 'btn-danger' : 'btn-outline'}`}
                        onClick={() => handlePublishSignal(zone.id, 'CONSTRAINED')}
                      >
                        CONSTRAINED
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        className="btn btn-outline btn-xs flex items-center gap-1"
                        onClick={() => setPricingModalZone(zone)}
                      >
                        <Sliders size={12} /> Pricing Params
                      </button>

                      <button 
                        type="button"
                        className={`btn btn-xs flex items-center gap-1 ${isCurtailed ? 'btn-success' : 'btn-danger'}`}
                        onClick={() => handleToggleCurtailment(zone.id, isCurtailed)}
                      >
                        <Power size={12} /> {isCurtailed ? 'Lift Curtailment' : 'Trigger Curtailment'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing Modal */}
      {pricingModalZone && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card shadow-lg" style={{ width: '460px', padding: '1.75rem', backgroundColor: '#ffffff' }}>
            <h3 className="text-lg font-bold mb-2">Dynamic Pricing Engine - {pricingModalZone.name}</h3>
            <p className="text-xs text-muted mb-4">Adjust pricing floor, ceiling, and elasticity parameters feeding the dynamic pricing engine.</p>
            
            <form onSubmit={handleUpdatePricing} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold">Floor Tariff ($/kWh)</label>
                <input type="number" step="0.01" name="floor_price" defaultValue={pricingModalZone.pricing_config?.floor_price || 0.10} required />
              </div>

              <div>
                <label className="text-xs font-semibold">Ceiling Tariff ($/kWh)</label>
                <input type="number" step="0.01" name="ceiling_price" defaultValue={pricingModalZone.pricing_config?.ceiling_price || 0.25} required />
              </div>

              <div>
                <label className="text-xs font-semibold">Price Elasticity Factor</label>
                <input type="number" step="0.1" name="elasticity_factor" defaultValue={pricingModalZone.pricing_config?.elasticity_factor || 1.0} required />
              </div>

              <div className="flex gap-2 justify-end mt-4 pt-3 border-t">
                <button type="button" className="btn btn-outline" onClick={() => setPricingModalZone(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Pricing Parameters</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
