import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { toast } from '../utils/toast';
import ListingCard from '../components/ListingCard';

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
      fetchListings(zoneId); // Refresh to get the new remaining quantity
    } catch (err) {
      toast.error(err.toString());
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1>Marketplace</h1>
        <select 
          value={zoneId} 
          onChange={(e) => setZoneId(e.target.value)}
          style={{ width: '200px', marginBottom: 0 }}
        >
          <option value="">All Zones</option>
          <option value="ZONE-1">Zone 1</option>
          <option value="ZONE-2">Zone 2</option>
          <option value="ZONE-3">Zone 3</option>
        </select>
      </div>

      {loading ? (
        <div>Loading listings...</div>
      ) : listings.length === 0 ? (
        <div className="card text-center p-8 text-muted">No active listings in this zone.</div>
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

      {selectedListing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div className="card" style={{ width: '400px' }}>
            <h2 className="mb-4">Confirm Purchase</h2>
            <div className="mb-4 p-4" style={{ backgroundColor: 'var(--color-bg-offset)', borderRadius: '8px' }}>
              <div className="flex justify-between mb-2">
                <span className="text-muted">Producer:</span>
                <span className="font-bold">{selectedListing.producer_name || 'Producer'}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-muted">Available:</span>
                <span className="font-bold">{Number(selectedListing.remaining_kwh).toFixed(2)} kWh</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-muted">Price:</span>
                <span className="font-bold">${Number(selectedListing.asking_price).toFixed(2)}/kWh</span>
              </div>
            </div>
            
            <form onSubmit={handleBuySubmit}>
              <label className="text-sm font-bold mb-2" style={{ display: 'block' }}>Quantity to Purchase (kWh)</label>
              <input 
                type="number" 
                step="0.01" 
                min="0.01"
                max={selectedListing.remaining_kwh}
                value={orderQuantity} 
                onChange={(e) => setOrderQuantity(e.target.value)} 
                required 
              />
              
              <div className="mt-4 p-4 text-center" style={{ border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                <span className="text-muted text-sm block mb-1">Estimated Total</span>
                <span className="font-bold text-2xl text-primary">
                  ${orderQuantity ? (Number(orderQuantity) * Number(selectedListing.asking_price)).toFixed(2) : '0.00'}
                </span>
              </div>

              <div className="flex gap-4 mt-6">
                <button type="button" className="btn btn-outline" onClick={() => setSelectedListing(null)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirm Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
