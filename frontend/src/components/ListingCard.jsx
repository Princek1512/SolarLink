import React from 'react';
import { ArrowRight, MapPin, User, Clock, Zap } from 'lucide-react';

export default function ListingCard({ listing, onBuy }) {
  return (
    <div className="card flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        <div className="flex justify-between items-center mb-3 pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
              <User size={13} color="var(--color-primary)" />
            </div>
            <span className="text-sm font-semibold text-slate-900">{listing.producer_name || 'Prosumer'}</span>
          </div>
          <span className="badge badge-success">ACTIVE OFFER</span>
        </div>
        
        <div className="flex items-center gap-1.5 mb-3 text-xs text-muted">
          <MapPin size={13} color="var(--color-text-muted)" />
          <span className="font-medium">{listing.zone_id}</span>
        </div>
        
        <div className="flex items-baseline gap-1 my-2">
          <span className="font-bold text-2xl text-slate-900">{Number(listing.remaining_kwh).toFixed(2)}</span>
          <span className="text-sm font-semibold text-muted">kWh</span>
        </div>
        <p className="text-xs text-muted mb-0">Eligible Solar Surplus Energy</p>
      </div>

      <div className="mt-4 pt-3 border-t">
        <div className="flex justify-between items-end mb-4">
          <div>
            <div className="text-xs text-muted">Asking Price</div>
            <div className="font-bold text-lg text-primary">${Number(listing.asking_price).toFixed(2)}<span className="text-xs text-muted">/kWh</span></div>
          </div>
          <div className="text-right">
             <div className="flex items-center gap-1 justify-end text-xs text-muted font-mono">
               <Clock size={12} />
               <span>{new Date(listing.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             </div>
          </div>
        </div>
        
        {onBuy && (
          <button onClick={() => onBuy(listing)} className="btn btn-primary w-full">
            Purchase Energy <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
