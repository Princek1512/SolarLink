import React from 'react';
import { DollarSign, Percent, ShieldCheck, Clock } from 'lucide-react';

export default function SettlementCard({ settlement }) {
  if (!settlement) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={20} color="var(--color-primary)" />
          <h3 style={{ margin: 0 }}>Settlement Status</h3>
        </div>
        <div className="p-4 rounded text-center" style={{ background: 'var(--color-bg)', border: '1px border var(--color-border)' }}>
          <p className="text-sm font-bold text-muted mb-1">Settlement Pending Delivery Verification</p>
          <p className="text-xs text-muted" style={{ margin: 0 }}>
            Financial transfers and fee calculations will be finalized once energy delivery is verified by smart meters.
          </p>
        </div>
      </div>
    );
  }

  const isRefunded = Number(settlement.refund_amount) > 0;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={20} color="var(--color-success)" />
        <h3 style={{ margin: 0 }}>Settlement Details</h3>
      </div>
      
      <div className="grid gap-4 mt-4 text-sm">
        <div className="flex justify-between pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-muted">Gross Amount</span>
          <span className="font-bold">${Number(settlement.gross_amount).toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-muted flex items-center gap-1"><Percent size={14} /> Platform Fee</span>
          <span className="font-bold text-muted">-${Number(settlement.platform_fee).toFixed(2)}</span>
        </div>

        <div className="flex justify-between pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-muted flex items-center gap-1"><Percent size={14} /> Grid Congestion Fee</span>
          <span className="font-bold text-muted">-${Number(settlement.grid_fee).toFixed(2)}</span>
        </div>

        {isRefunded && (
          <div className="flex justify-between pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-muted" style={{ color: 'var(--color-warning)' }}>Shortfall Refund</span>
            <span className="font-bold" style={{ color: 'var(--color-warning)' }}>-${Number(settlement.refund_amount).toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between pt-2 mt-2">
          <span className="font-bold">Prosumer Credit</span>
          <span className="font-bold" style={{ color: 'var(--color-success)' }}>+${Number(settlement.seller_credit).toFixed(2)}</span>
        </div>

        <div className="flex justify-between pb-2">
          <span className="font-bold">Consumer Debit</span>
          <span className="font-bold" style={{ color: 'var(--color-danger)' }}>-${Number(settlement.buyer_debit).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
