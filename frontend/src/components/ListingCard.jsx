import React from 'react';
import { ArrowRight, MapPin, User, Clock } from 'lucide-react';

export default function ListingCard({ listing, onBuy }) {
  return (
    <div className="card flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <User size={16} color="var(--color-text-muted)" />
            <span className="text-sm font-bold">{listing.producer_name || 'Producer'}</span>
          </div>
          <span className="badge badge-success">Active</span>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={14} color="var(--color-text-muted)" />
          <span className="text-xs text-muted">{listing.zone_id}</span>
        </div>
        
        <h3 style={{ margin: 0 }}>{Number(listing.remaining_kwh).toFixed(2)} kWh</h3>
        <p className="text-muted text-sm mt-2">Available Solar Surplus</p>
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex justify-between items-end mb-4">
          <div>
            <div className="text-sm text-muted">Asking Price</div>
            <div className="font-bold text-lg">${Number(listing.asking_price).toFixed(2)}<span className="text-sm text-muted">/kWh</span></div>
          </div>
          <div className="text-right">
             <div className="flex items-center gap-1 justify-end text-xs text-muted">
               <Clock size={12} />
               <span>{new Date(listing.created_at).toLocaleString()}</span>
             </div>
          </div>
        </div>
        
        {onBuy && (
          <button onClick={() => onBuy(listing)} className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
            Buy Energy <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
