import React from 'react';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

const STAGES = ['MATCHED', 'LOCKED', 'DELIVERED', 'VERIFIED', 'SETTLED'];

export default function TradeStatus({ status, isDisputed }) {
  if (status === 'CANCELLED' || isDisputed) {
    return (
      <div className="flex items-center gap-2 p-3 rounded" style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: 'var(--color-danger)' }}>
        <AlertCircle size={20} />
        <span className="font-bold">{isDisputed ? 'TRADE DISPUTED — Shortfall Detected' : 'TRADE CANCELLED'}</span>
      </div>
    );
  }

  const currentIndex = STAGES.indexOf(status);

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div className="flex items-center justify-between" style={{ width: '100%' }}>
        {STAGES.map((stage, idx) => {
          const isCompleted = idx <= currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <React.Fragment key={stage}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '70px' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isCompleted ? (isCurrent ? 'var(--color-primary)' : 'var(--color-success)') : 'var(--color-bg)',
                  border: `2px solid ${isCompleted ? (isCurrent ? 'var(--color-primary)' : 'var(--color-success)') : 'var(--color-border)'}`,
                  color: isCompleted ? 'white' : 'var(--color-text-muted)',
                  transition: 'all 0.2s ease',
                  marginBottom: 8
                }}>
                  {isCompleted ? (
                    <CheckCircle size={18} color="white" />
                  ) : (
                    <Circle size={18} color="var(--color-border)" />
                  )}
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? 'var(--color-primary)' : isCompleted ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.5px'
                }}>
                  {stage}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                <div style={{
                  flex: 1,
                  height: 3,
                  backgroundColor: idx < currentIndex ? 'var(--color-success)' : 'var(--color-border)',
                  margin: '0 8px',
                  marginBottom: 24, // Align horizontally with middle of 32px icon circle
                  borderRadius: 2,
                  transition: 'all 0.2s ease'
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
