import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';
import AuditTimeline from '../components/AuditTimeline';

export default function Audit() {
  const [dashData, setDashData] = useState(null);
  const [searchId, setSearchId] = useState('');
  const [tradeEvents, setTradeEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRegulatorDashboard()
      .then(setDashData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchId) return;
    try {
      const events = await api.getTradeEvents(searchId);
      setTradeEvents(events);
    } catch (err) {
      toast.error('Failed to load trade events: ' + err.toString());
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="mb-8">Compliance Audit Ledger</h1>
      
      <div className="card mb-8">
        <h3 className="mb-4">Global Ledger Integrity</h3>
        <p className="text-sm text-muted mb-4">
          The system continuously recalculates cryptographic hashes across the entire event stream to detect tampering.
        </p>
        
        {dashData?.ledger_valid?.valid ? (
          <div className="p-4" style={{ backgroundColor: '#e8f5e9', border: '1px solid var(--color-success)', borderRadius: '4px' }}>
            <span className="font-bold" style={{ color: 'var(--color-success)' }}>VERIFIED</span> - No tampering detected across {dashData.ledger_valid.length} blocks.
          </div>
        ) : (
          <div className="p-4" style={{ backgroundColor: '#ffebee', border: '1px solid var(--color-danger)', borderRadius: '4px' }}>
            <span className="font-bold" style={{ color: 'var(--color-danger)' }}>INVALID</span> - Tampering detected in the hash chain!
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="mb-4">Inspect Trade Lifecycle</h3>
        
        <form onSubmit={handleSearch} className="flex flex-wrap-responsive gap-4 mb-8">
          <input 
            type="text" 
            placeholder="Enter Trade ID (e.g., UUID)" 
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <button type="submit" className="btn btn-primary"><Search size={16} /> Audit Trade</button>
        </form>

        {tradeEvents.length > 0 && (
          <AuditTimeline events={tradeEvents} isLedgerValid={dashData?.ledger_valid?.valid} />
        )}
      </div>
    </div>
  );
}
