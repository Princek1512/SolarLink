/**
 * Trade lifecycle, per BLOCKCHAIN_DESIGN.md §6:
 *
 *   MATCHED -> LOCKED -> DELIVERED -> VERIFIED -> SETTLED
 *                              \-> DISPUTED -> SETTLED
 *
 * MATCHED/LOCKED -> CANCELLED is included for the congestion-pause case
 * (design doc §19: a paused trade should never be created/locked on-chain;
 * this lets the adapter record the rejection instead of silently dropping it).
 */
const TradeStatus = Object.freeze({
  MATCHED: 'MATCHED',
  LOCKED: 'LOCKED',
  DELIVERED: 'DELIVERED',
  VERIFIED: 'VERIFIED',
  SETTLED: 'SETTLED',
  DISPUTED: 'DISPUTED',
  CANCELLED: 'CANCELLED',
});

const VALID_TRANSITIONS = {
  [TradeStatus.MATCHED]: [TradeStatus.LOCKED, TradeStatus.CANCELLED],
  [TradeStatus.LOCKED]: [TradeStatus.DELIVERED, TradeStatus.CANCELLED],
  [TradeStatus.DELIVERED]: [TradeStatus.VERIFIED, TradeStatus.DISPUTED],
  [TradeStatus.VERIFIED]: [TradeStatus.SETTLED],
  [TradeStatus.DISPUTED]: [TradeStatus.SETTLED],
  [TradeStatus.SETTLED]: [],
  [TradeStatus.CANCELLED]: [],
};

function assertTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    const err = new Error(`Invalid trade state transition: ${from} -> ${to}`);
    err.code = 'INVALID_TRANSITION';
    throw err;
  }
}

module.exports = { TradeStatus, VALID_TRANSITIONS, assertTransition };
