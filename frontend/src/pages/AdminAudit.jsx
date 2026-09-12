import React, { useEffect, useState } from 'react';
import { Search, Shield, Filter, Database, Terminal, DollarSign } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';

const EVENT_COLORS = {
  LISTING_CREATED: 'var(--color-gold)', ENERGY_PURCHASED: 'var(--color-primary-accent)',
  TRADE_SETTLED: 'var(--color-success)', DEPOSIT_REQUESTED: '#b8860b',
  DEPOSIT_APPROVED: 'var(--color-success)', USER_REQUEST_APPROVED: 'var(--color-success)',
  USER_REQUEST_REJECTED: 'var(--color-danger)', TRADE_LOCKED: 'var(--color-primary)',
  TRADE_DELIVERED: '#4b5563', TRADE_VERIFIED: 'var(--color-success)'
};

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Filters
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Blockchain
  const [blockchain, setBlockchain] = useState(null);
  const [showBlockchain, setShowBlockchain] = useState(false);

  // Trade event search
  const [tradeSearchId, setTradeSearchId] = useState('');
  const [tradeEvents, setTradeEvents] = useState([]);

  const fetchLogs = async (p = 1) => {
    try {
      setLoading(true);
      // Exclude generic USER_LOGIN events so only transaction history is shown
      const params = { page: p, limit: LIMIT, exclude_type: 'USER_LOGIN' };
      if (search) params.search = search;
      if (eventType) params.event_type = eventType;
      if (actorRole) params.actor_role = actorRole;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const data = await api.getAuditLogs(params);
      
      // Secondary filter safety check
      const filtered = (data.logs || []).filter(l => l.event_type !== 'USER_LOGIN');
      setLogs(filtered);
      setTotal(data.total);
      setPage(p);
    } catch (err) {
      toast.error('Failed to load transaction history: ' + err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(1); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleTradeSearch = async (e, customId) => {
    if (e) e.preventDefault();
    const idToUse = customId || tradeSearchId.trim();
    if (!idToUse) return;
    try {
      setTradeSearchId(idToUse);
      const events = await api.getTradeEvents(idToUse);
      const list = Array.isArray(events) ? events : [];
      setTradeEvents(list);
      if (list.length === 0) {
        toast.info(`No lifecycle events found for trade ID matching "${idToUse}".`);
      } else {
        toast.success(`Found ${list.length} transaction lifecycle event(s).`);
      }
    } catch (err) {
      toast.error('Search error: ' + err.toString());
      setTradeEvents([]);
    }
  };

  const handleLoadBlockchain = async () => {
    try {
      const data = await api.getBlockchainLedger();
      setBlockchain(data);
      setShowBlockchain(true);
    } catch (err) {
      toast.error('Failed to load blockchain ledger: ' + err.toString());
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-2.5">
            <DollarSign size={24} color="var(--color-primary)" />
            <h1 className="mb-0">Trade & Financial Transaction History</h1>
          </div>
          <p className="text-sm text-muted mb-0 mt-1">Immutable transaction ledger, trade creation, energy settlement, & financial audit trail</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleLoadBlockchain}>
          <Database size={14} /> {showBlockchain ? 'Refresh Ledger' : 'Load Blockchain Ledger'}
        </button>
      </div>

      {/* Filter Toolbar Card */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-4 items-end">
            <div>
              <label>Transaction Keyword Search</label>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search actor, trade ID, details…"
              />
            </div>
            <div>
              <label>Transaction Event Type</label>
              <select value={eventType} onChange={e => setEventType(e.target.value)}>
                <option value="">All Transaction Types</option>
                {[
                  'LISTING_CREATED',
                  'ENERGY_PURCHASED',
                  'TRADE_SETTLED',
                  'TRADE_LOCKED',
                  'TRADE_DELIVERED',
                  'TRADE_VERIFIED',
                  'DEPOSIT_REQUESTED',
                  'DEPOSIT_APPROVED',
                  'USER_REQUEST_APPROVED',
                  'USER_REQUEST_REJECTED'
                ].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Actor Role</label>
              <select value={actorRole} onChange={e => setActorRole(e.target.value)}>
                <option value="">All Roles</option>
                {['admin','prosumer','consumer','regulator','utility'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Transaction Date Filter</label>
              <div className="flex gap-2">
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="From" />
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="To" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t">
            <button type="submit" className="btn btn-primary btn-sm">
              <Search size={14} /> Filter Transactions
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { setSearch(''); setEventType(''); setActorRole(''); setFromDate(''); setToDate(''); setTimeout(() => fetchLogs(1), 0); }}
            >
              <Filter size={14} /> Clear Filters
            </button>
          </div>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="table-responsive mb-8">
        <div className="p-4 bg-white border-b flex items-center justify-between">
          <h3 className="m-0 text-base">Recorded Trade Transactions — <b>{total} total records</b></h3>
          <span className="badge badge-neutral text-xs">Append-Only • Cryptographically Immutable</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted">Loading trade transaction records…</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted">No trade transaction records match your search filters.</div>
        ) : (
          <table>
            <thead>
              <tr>
                {['Timestamp', 'Transaction Event', 'Actor', 'Role', 'Entity', 'Trade / Entity ID', 'Status', 'Transaction Details'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="text-xs text-muted font-mono" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span className="event-badge" style={{
                      backgroundColor: `${EVENT_COLORS[log.event_type] || '#8c5638'}15`,
                      color: EVENT_COLORS[log.event_type] || 'var(--color-primary)',
                      border: `1px solid ${EVENT_COLORS[log.event_type] || '#8c5638'}35`
                    }}>
                      {log.event_type}
                    </span>
                  </td>
                  <td>
                    <div className="font-semibold text-sm">{log.actor_name || '—'}</div>
                    {log.actor_email && <div className="text-xs text-muted">{log.actor_email}</div>}
                  </td>
                  <td><span className="badge badge-neutral">{log.actor_role || '—'}</span></td>
                  <td className="text-xs text-muted">{log.entity_type || '—'}</td>
                  <td>
                    {log.entity_id ? (
                      <button
                        type="button"
                        className="font-mono text-xs text-primary cursor-pointer hover:underline bg-transparent border-0 p-0"
                        title={`Click to inspect trade lifecycle for ${log.entity_id}`}
                        onClick={() => handleTradeSearch(null, log.entity_id)}
                      >
                        {log.entity_id.substring(0, 14)}…
                      </button>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    {log.status && (
                      <span className={`badge ${log.status === 'SUCCESS' || log.status === 'APPROVED' || log.status === 'ACTIVE' || log.status === 'SETTLED' ? 'badge-success' : log.status === 'PENDING' ? 'badge-warning' : 'badge-neutral'}`}>
                        {log.status}
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-muted" style={{ maxWidth: 240 }}>
                    {log.details ? (
                      <div className="font-mono text-xs text-truncate" title={JSON.stringify(log.details)}>
                        {JSON.stringify(log.details).substring(0, 50)}…
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 bg-white border-t flex items-center justify-between">
            <span className="text-xs text-muted font-medium">Showing page {page} of {totalPages} ({total} entries)</span>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>← Prev</button>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Blockchain Ledger Display */}
      {showBlockchain && blockchain && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4 pb-3 border-b">
            <div className="flex items-center gap-2">
              <Database size={18} color="var(--color-primary)" />
              <h3 className="m-0">Cryptographic Blockchain Trade Ledger</h3>
            </div>
            <span className={`badge ${blockchain.ledger_valid?.valid ? 'badge-success' : 'badge-danger'}`}>
              {blockchain.ledger_valid?.valid ? '✓ SHA-256 HashChain Verified' : '✗ Tampering Detected'}
            </span>
          </div>

          <div className="table-responsive" style={{ maxHeight: 350, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {['Timestamp', 'Event Type', 'Trade ID', 'Event Hash (SHA-256)', 'Previous Hash'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blockchain.events.map(e => (
                  <tr key={e.id}>
                    <td className="text-xs font-mono text-muted">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="font-semibold text-xs">{e.event_type}</td>
                    <td className="text-xs font-mono text-muted">{e.trade_id?.substring(0, 12)}…</td>
                    <td className="text-xs font-mono text-primary">{e.event_hash?.substring(0, 24)}…</td>
                    <td className="text-xs font-mono text-muted">{e.previous_hash ? e.previous_hash.substring(0, 16) + '…' : 'GENESIS'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade Event Inspector */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Terminal size={18} color="var(--color-primary)" />
          <h3 className="m-0">Trade Lifecycle Event Inspector</h3>
        </div>
        <form onSubmit={handleTradeSearch} className="flex gap-3 mb-6">
          <input
            type="text"
            value={tradeSearchId}
            onChange={e => setTradeSearchId(e.target.value)}
            placeholder="Paste Trade UUID to view cryptographic lifecycle chain…"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            <Search size={14} /> Inspect Lifecycle
          </button>
        </form>

        {tradeEvents.length > 0 && (
          <div className="flex flex-col gap-3">
            {tradeEvents.map((e, idx) => (
              <div key={idx} className="p-4 rounded border bg-slate-50 flex items-start gap-4">
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-slate-900">{e.eventType || e.event_type}</span>
                    <span className="text-xs text-muted font-mono">{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-xs font-mono text-muted">Hash: <span className="text-slate-700">{(e.currentHash || e.event_hash || '').substring(0, 40)}…</span></div>
                  {(e.eventData || e.event_data) && (
                    <pre className="text-xs mt-2 p-3 rounded border bg-white font-mono overflow-auto" style={{ maxHeight: 150 }}>
                      {JSON.stringify(e.eventData || e.event_data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .event-badge {
          display: inline-flex;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }
        .text-truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
