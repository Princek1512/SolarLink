import React from 'react';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

const STAGES = ['MATCHED', 'LOCKED', 'DELIVERED', 'VERIFIED', 'SETTLED'];

export default function TradeStatus({ status, isDisputed }) {
  // If disputed or cancelled, show special state
  if (status === 'CANCELLED' || isDisputed) {
    return (
      <div className="flex items-center gap-2" style={{ color: 'var(--color-danger)' }}>
        <AlertCircle size={20} />
        <span className="font-bold">{isDisputed ? 'DISPUTED' : 'CANCELLED'}</span>
      </div>
    );
  }

  const currentIndex = STAGES.indexOf(status);

  return (
    <div className="flex items-center gap-2">
      {STAGES.map((stage, idx) => {
        const isCompleted = idx <= currentIndex;
        const isCurrent = idx === currentIndex;
        
        return (
          <div key={stage} className="flex items-center">
            <div className="flex-col items-center flex" style={{ position: 'relative' }}>
              {isCompleted ? (
                <CheckCircle size={20} color={isCurrent ? "var(--color-secondary)" : "var(--color-success)"} fill={isCurrent ? "transparent" : "#e8f5e9"} />
              ) : (
                <Circle size={20} color="var(--color-border)" />
              )}
              <span style={{ 
                position: 'absolute', top: '24px', fontSize: '0.65rem', 
                color: isCurrent ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                fontWeight: isCurrent ? 700 : 500
              }}>
                {stage}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div style={{ 
                width: '30px', height: '2px', 
                backgroundColor: isCompleted && idx < currentIndex ? 'var(--color-success)' : 'var(--color-border)',
                margin: '0 4px',
                transform: 'translateY(-8px)' // align with circle center
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
