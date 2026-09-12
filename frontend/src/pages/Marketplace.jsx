import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';
import ListingCard from '../components/ListingCard';
import { ShoppingBag, Filter, CheckCircle, X } from 'lucide-react';

export default function Marketplace({ user }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoneId, setZoneId] = useState('');
  
  // Order form state
  const [selectedListing, setSelectedListing] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState('');

  const fetchListings = async (zone) => {
    setLoading(true);
    try {
      const data = await api.getListings(zone);
      setListings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings(zoneId);
  }, [zoneId]);

  const handleBuySubmit = async (e) => {
    e.preventDefault();
    try {
      await api.purchaseListing(selectedListing.id, {
        quantityKwh: Number(orderQuantity)
      });
      toast.success('Energy Purchased Successfully!');
      setSelectedListing(null);
      setOrderQuantity('');
      fetchListings(zoneId);
    } catch (err) {
      toast.error(err.toString());
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <ShoppingBag size={24} color="var(--color-primary)" />
            <h1 className="mb-0">P2P Solar Marketplace</h1>
          </div>
          <p className="text-sm text-muted mb-0 mt-1">Browse live prosumer surplus offers & execute localized microgrid purchases</p>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} color="var(--color-text-muted)" />
          <select 
            value={zoneId} 
            onChange={(e) => setZoneId(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="">All Grid Zones</option>
            <option value="ZONE-1">Zone 1 (Downtown)</option>
            <option value="ZONE-2">Zone 2 (Suburbs)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card text-center p-12 text-muted">Loading live marketplace offers…</div>
      ) : listings.length === 0 ? (
        <div className="card text-center p-12 text-muted">No active energy listings found in this zone.</div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {listings.map(l => (
            <ListingCard 
              key={l.id} 
              listing={l} 
              onBuy={user.role === 'consumer' ? setSelectedListing : null} 
            />
          ))}
        </div>
      )}

      {/* Modern Modal Overlay */}
      {selectedListing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card shadow-lg" style={{ width: '440px', padding: '1.75rem' }}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h2 className="m-0 text-lg font-bold">Confirm Energy Order</h2>
              <button onClick={() => setSelectedListing(null)} className="btn btn-outline btn-sm p-1 border-0">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 p-4 rounded-lg bg-slate-50 border">
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-muted">Prosumer:</span>
                <span className="font-bold text-slate-900">{selectedListing.producer_name || 'Prosumer'}</span>
              </div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-muted">Available Surplus:</span>
                <span className="font-bold text-slate-900">{Number(selectedListing.remaining_kwh).toFixed(2)} kWh</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Unit Price Rate:</span>
                <span className="font-bold text-primary">${Number(selectedListing.asking_price).toFixed(2)}/kWh</span>
              </div>
            </div>
            
            <form onSubmit={handleBuySubmit} className="flex flex-col gap-4">
              <div>
                <label>Quantity to Purchase (kWh)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  max={selectedListing.remaining_kwh}
                  value={orderQuantity} 
                  onChange={(e) => setOrderQuantity(e.target.value)} 
                  placeholder="Enter kWh quantity"
                  required 
                />
              </div>
              
              <div className="p-4 text-center rounded-lg bg-[#fcf3ed] border border-[#e2dcd5]">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">Estimated Total Cost</span>
                <span className="font-bold text-2xl text-primary">
                  ${orderQuantity ? (Number(orderQuantity) * Number(selectedListing.asking_price)).toFixed(2) : '0.00'}
                </span>
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setSelectedListing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1"><CheckCircle size={15} /> Confirm Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
