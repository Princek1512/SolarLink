import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';
import SettlementCard from '../components/SettlementCard';
import TradeStatus from '../components/TradeStatus';

export default function Settlement() {
  const { id } = useParams();
  const [trade, setTrade] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const fetchTrade = () => {
    setLoading(true);
    Promise.all([
      api.getTrade(id),
      api.getTradeEvents(id)
    ])
    .then(([tradeData, eventData]) => {
      setTrade(tradeData);
      setEvents(eventData);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTrade();
  }, [id]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await api.verifyDelivery(id);
      toast.success('Delivery manually verified successfully');
      fetchTrade(); // reload
    } catch (err) {
      toast.error(err.toString());
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!trade) return <div>Trade not found</div>;

  const isComplete = ['VERIFIED', 'SETTLED', 'DISPUTED'].includes(trade.status);

  return (
    <div>
      <div className="mb-6">
        <Link to="/trades" className="text-sm font-bold text-muted flex items-center gap-1" style={{ textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Trades
        </Link>
      </div>

      <div className="flex flex-wrap-responsive justify-between items-center mb-8">
        <h1>Trade Settlement</h1>
        {!isComplete && (
          <button onClick={handleVerify} disabled={verifying} className="btn btn-primary">
            {verifying ? 'Processing...' : 'Manual Verify Delivery'}
          </button>
        )}
      </div>

      <div className="mb-8">
        <TradeStatus status={trade.status} />
      </div>

      <div className="grid grid-cols-2 gap-8">
        <SettlementCard settlement={trade.settlement} />
        
        <div className="card">
          <h3 className="mb-4">Trade Context</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted mb-1">Contracted Amount</div>
              <div className="font-bold">{Number(trade.quantity_kwh).toFixed(2)} kWh</div>
            </div>
            <div>
              <div className="text-muted mb-1">Agreed Price</div>
              <div className="font-bold">${Number(trade.agreed_price).toFixed(2)} / kWh</div>
            </div>
            <div>
              <div className="text-muted mb-1">Delivery Status</div>
              <div className="font-bold">{Number(trade.delivered_kwh || 0).toFixed(2)} kWh</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
