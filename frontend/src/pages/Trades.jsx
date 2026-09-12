import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import TradeStatus from '../components/TradeStatus';
import { Clock, Activity, ArrowUpRight } from 'lucide-react';

export default function Trades({ user }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTrades()
      .then(setTrades)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card text-center p-12 text-muted">Loading trade history…</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <Activity size={24} color="var(--color-primary)" />
            <h1 className="mb-0">My P2P Energy Trades</h1>
          </div>
          <p className="text-sm text-muted mb-0 mt-1">Track your active & settled solar energy trade execution history</p>
        </div>
      </div>
      
      {trades.length === 0 ? (
        <div className="card text-center p-12 text-muted">
          No trades found for your account yet.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {trades.map(t => {
            const isSeller = t.seller_id === user.id;
            const roleLabel = isSeller ? 'Producer (You)' : 'Consumer (You)';

            return (
              <div key={t.id} className="card p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="badge badge-neutral">{t.zone_id}</span>
                    <span className="badge badge-success">{roleLabel}</span>
                  </div>
                  
                  <Link to={`/trades/${t.id}/settlement`} className="btn btn-outline btn-sm">
                    View Settlement Invoice <ArrowUpRight size={14} />
                  </Link>
                </div>

                <div className="grid grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border">
                  <div>
                    <div className="text-xs text-muted font-semibold uppercase">Producer</div>
                    <div className="font-bold text-sm text-slate-900">{t.seller_name || t.seller_id.substring(0, 8)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted font-semibold uppercase">Consumer</div>
                    <div className="font-bold text-sm text-slate-900">{t.buyer_name || t.buyer_id.substring(0, 8)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted font-semibold uppercase">Energy Quantity</div>
                    <div className="font-bold text-sm text-slate-900">{Number(t.quantity_kwh).toFixed(2)} kWh</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted font-semibold uppercase">Total Value</div>
                    <div className="font-bold text-sm text-primary">${(Number(t.quantity_kwh) * Number(t.agreed_price)).toFixed(2)}</div>
                  </div>
                </div>

                <TradeStatus status={t.status} />

                <div className="text-xs text-muted flex items-center gap-1 font-mono pt-2 border-t">
                  <Clock size={12} />
                  <span>Created: {new Date(t.created_at).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
