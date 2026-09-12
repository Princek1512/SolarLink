import React, { useEffect, useState } from 'react';
import { Search, Shield, Filter } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';

const EVENT_COLORS = {
  USER_REGISTERED: '#6366f1', USER_LOGIN: '#10b981',
  LISTING_CREATED: 'var(--color-secondary)', ENERGY_PURCHASED: 'var(--color-primary)',
  TRADE_SETTLED: 'var(--color-success)', DEPOSIT_REQUESTED: '#f59e0b',
  DEPOSIT_APPROVED: 'var(--color-success)', USER_REQUEST_APPROVED: 'var(--color-success)',
  USER_REQUEST_REJECTED: 'var(--color-danger)',
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
      const params = { page: p, limit: LIMIT };
      if (search) params.search = search;
      if (eventType) params.event_type = eventType;
      if (actorRole) params.actor_role = actorRole;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const data = await api.getAuditLogs(params);
      setLogs(data.logs);
      setTotal(data.total);
      setPage(p);
    } catch (err) {
      toast.error('Failed to load audit logs: ' + err.toString());
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
        toast.info(`No events found for ID matching "${idToUse}".`);
      } else {
        toast.success(`Found ${list.length} lifecycle event(s).`);
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
      toast.error('Failed to load blockchain: ' + err.toString());
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="flex items-center gap-2 mb-8">
        <Shield size={28} color="var(--color-primary)" />
        <h1 style={{ margin: 0 }}>Audit Log</h1>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="grid gap-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-muted block mb-1">Search</label>
              <div className="flex items-center gap-2">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Actor name, email, entity ID…" style={{ marginBottom: 0 }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">Event Type</label>
              <select value={eventType} onChange={e => setEventType(e.target.value)} style={{ width: '100%', marginBottom: 0 }}>
                <option value="">All Events</option>
                {['USER_REGISTERED','USER_LOGIN','LISTING_CREATED','ENERGY_PURCHASED','TRADE_SETTLED','DEPOSIT_REQUESTED','DEPOSIT_APPROVED','USER_REQUEST_APPROVED','USER_REQUEST_REJECTED'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">Actor Role</label>
              <select value={actorRole} onChange={e => setActorRole(e.target.value)} style={{ width: '100%', marginBottom: 0 }}>
                <option value="">All Roles</option>
                {['admin','prosumer','consumer','regulator','utility'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted block mb-1">Date Range</label>
              <div className="flex gap-2">
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ marginBottom: 0, flex: 1 }} />
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ marginBottom: 0, flex: 1 }} />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary"><Search size={14} className="inline mr-1" />Search Audit Logs</button>
            <button type="button" className="btn btn-outline" onClick={() => { setSearch(''); setEventType(''); setActorRole(''); setFromDate(''); setToDate(''); setTimeout(() => fetchLogs(1), 0); }}>
              <Filter size={14} className="inline mr-1" />Clear
            </button>
          </div>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="card mb-8" style={{ padding: 0 }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ margin: 0 }}>Platform Events — {total} total records</h3>
          <span className="text-xs text-muted">Append-only • Immutable</span>
        </div>
        {loading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-muted">No audit events match your filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead style={{ background: 'var(--color-bg)' }}>
                <tr>
                  {['Timestamp', 'Event', 'Actor', 'Role', 'Entity', 'Entity ID', 'Status', 'Details'].map(h => (
                    <th key={h} className="p-3 text-left text-xs font-bold text-muted" style={{ borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="p-3 text-xs" style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3">
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: (EVENT_COLORS[log.event_type] || '#aaa') + '22', color: EVENT_COLORS[log.event_type] || '#aaa', whiteSpace: 'nowrap' }}>
                        {log.event_type}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      <div className="font-bold">{log.actor_name || '—'}</div>
                      {log.actor_email && <div className="text-xs text-muted">{log.actor_email}</div>}
                    </td>
                    <td className="p-3"><span className="badge badge-neutral text-xs">{log.actor_role || '—'}</span></td>
                    <td className="p-3 text-xs text-muted">{log.entity_type || '—'}</td>
                    <td className="p-3 text-xs" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.entity_id ? (
                        <button
                          type="button"
                          className="text-xs font-mono text-primary cursor-pointer hover:underline bg-transparent border-0 p-0"
                          title={`Click to inspect ${log.entity_id}`}
                          onClick={() => handleTradeSearch(null, log.entity_id)}
                        >
                          {log.entity_id.substring(0, 12)}…
                        </button>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      {log.status && <span className={`badge ${log.status === 'SUCCESS' || log.status === 'APPROVED' || log.status === 'ACTIVE' || log.status === 'SETTLED' ? 'badge-success' : log.status === 'PENDING' ? 'badge-danger' : 'badge-neutral'}`}>{log.status}</span>}
                    </td>
                    <td className="p-3 text-xs text-muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details ? <span title={JSON.stringify(log.details)}>{JSON.stringify(log.details).substring(0, 40)}…</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-between border-t" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="text-sm text-muted">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>← Prev</button>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Blockchain Ledger */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ margin: 0 }}>Blockchain Ledger</h3>
          <button className="btn btn-outline btn-sm" onClick={handleLoadBlockchain}>
            <Shield size={14} className="inline mr-1" />Load Blockchain Events
          </button>
        </div>
        {showBlockchain && blockchain && (
          <>
            <div className={`p-3 mb-4 rounded`} style={{ background: blockchain.ledger_valid?.valid ? '#e8f5e9' : '#ffebee', border: `1px solid ${blockchain.ledger_valid?.valid ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
              <span className="font-bold" style={{ color: blockchain.ledger_valid?.valid ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {blockchain.ledger_valid?.valid ? '✓ VERIFIED' : '✗ TAMPERED'}
              </span> — {blockchain.events.length} blockchain events loaded
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 400 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    {['Timestamp', 'Event Type', 'Trade ID', 'Hash (truncated)', 'Prev Hash'].map(h => (
                      <th key={h} className="p-2 text-left text-xs font-bold text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blockchain.events.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="p-2 text-xs">{new Date(e.timestamp).toLocaleString()}</td>
                      <td className="p-2 text-xs font-bold">{e.event_type}</td>
                      <td className="p-2 text-xs text-muted">{e.trade_id?.substring(0, 12)}…</td>
                      <td className="p-2 text-xs font-mono text-muted">{e.event_hash?.substring(0, 20)}…</td>
                      <td className="p-2 text-xs font-mono text-muted">{e.previous_hash ? e.previous_hash.substring(0, 16) + '…' : 'GENESIS'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Trade Event Lifecycle Search */}
      <div className="card">
        <h3 className="mb-4">Trade Lifecycle Inspector</h3>
        <form onSubmit={handleTradeSearch} className="flex gap-4 mb-6">
          <input
            type="text"
            value={tradeSearchId}
            onChange={e => setTradeSearchId(e.target.value)}
            placeholder="Enter Trade ID (UUID) to inspect lifecycle…"
            style={{ flex: 1, marginBottom: 0 }}
          />
          <button type="submit" className="btn btn-primary"><Search size={14} className="inline mr-1" />Inspect</button>
        </form>
        {tradeEvents.length > 0 && (
          <div className="flex flex-col gap-3">
            {tradeEvents.map((e, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 rounded" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)', flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-sm">{e.eventType || e.event_type}</span>
                    <span className="text-xs text-muted">{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-xs font-mono text-muted">Hash: {(e.currentHash || e.event_hash || '').substring(0, 32)}…</div>
                  {(e.eventData || e.event_data) && (
                    <pre className="text-xs mt-2 p-2 rounded" style={{ background: 'var(--color-card)', overflow: 'auto' }}>
                      {JSON.stringify(e.eventData || e.event_data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
