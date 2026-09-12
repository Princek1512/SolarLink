import React from 'react';
import { Lock, Link, AlertTriangle } from 'lucide-react';

export default function AuditTimeline({ events, isLedgerValid }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-8 pb-4" style={{ borderBottom: '2px solid var(--color-border)' }}>
        <h3 style={{ margin: 0 }}>Smart Contract Ledger</h3>
        {isLedgerValid ? (
          <span className="badge badge-success flex items-center gap-1">
            <Lock size={12} /> Cryptographically Valid
          </span>
        ) : (
          <span className="badge badge-danger flex items-center gap-1">
            <AlertTriangle size={12} /> Integrity Compromised
          </span>
        )}
      </div>

      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        <div style={{
          position: 'absolute',
          left: '11px',
          top: 0,
          bottom: 0,
          width: '2px',
          backgroundColor: isLedgerValid ? 'var(--color-success)' : 'var(--color-danger)',
          opacity: 0.3
        }} />

        {events.map((evt, idx) => (
          <div key={evt.id || idx} className="mb-6 relative">
            <div style={{
              position: 'absolute',
              left: '-29px',
              top: '4px',
              backgroundColor: 'var(--color-bg)',
              borderRadius: '50%',
              padding: '2px'
            }}>
              <Link size={16} color={isLedgerValid ? "var(--color-success)" : "var(--color-danger)"} />
            </div>
            
            <div className="text-sm font-bold mb-1">{evt.event_type}</div>
            <div className="text-xs text-muted mb-2">{new Date(evt.timestamp).toLocaleString()}</div>
            
            <div style={{
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              padding: '8px 12px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              wordBreak: 'break-all'
            }}>
              {evt.event_hash}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
