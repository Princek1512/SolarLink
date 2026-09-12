import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import TradeStatus from '../components/TradeStatus';
import { Clock } from 'lucide-react';

export default function Trades({ user }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTrades()
      .then(setTrades)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading trades...</div>;

  return (
    <div>
      <h1 className="mb-8">My Trades</h1>
      
      {trades.length === 0 ? (
        <div className="card text-center p-8 text-muted">
          No trades found.
        </div>
      ) : (
        <div className="grid gap-4">
          {trades.map(t => {
            const isSeller = t.seller_id === user.id;
            const roleLabel = isSeller ? 'Seller (You)' : 'Buyer (You)';

            return (
              <div key={t.id} className="card flex flex-wrap-responsive items-center justify-between">
                <div>
                  <div className="flex gap-4 items-center mb-2">
                    <span className="badge badge-neutral">{t.zone_id}</span>
                    <span className="text-sm font-bold text-muted">{roleLabel}</span>
                  </div>
                  <div className="mb-4 text-sm">
                    <span className="text-muted">Producer:</span> <span className="font-bold">{t.seller_name || t.seller_id.substring(0, 8)}</span>
                    <span className="mx-2 text-muted">•</span>
                    <span className="text-muted">Consumer:</span> <span className="font-bold">{t.buyer_name || t.buyer_id.substring(0, 8)}</span>
                  </div>
                  
                  <div className="flex flex-wrap-responsive gap-8 gap-responsive mb-4">
                    <div>
                      <div className="text-xs text-muted mb-1">Quantity</div>
                      <div className="font-bold">{Number(t.quantity_kwh).toFixed(2)} kWh</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted mb-1">Agreed Price</div>
                      <div className="font-bold">${Number(t.agreed_price).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted mb-1">Total Value</div>
                      <div className="font-bold">${(Number(t.quantity_kwh) * Number(t.agreed_price)).toFixed(2)}</div>
                    </div>
                  </div>

                  <TradeStatus status={t.status} />
                  
                  <div className="text-xs text-muted mt-4 flex items-center gap-1">
                    <Clock size={12} />
                    <span>Created: {new Date(t.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <Link to={`/trades/${t.id}/settlement`} className="btn btn-outline">
                    View Settlement
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
