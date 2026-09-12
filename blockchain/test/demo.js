/**
 * Run with: node test/demo.js
 *
 * Walks through the two flows from BLOCKCHAIN_DESIGN.md §6 and §18, then
 * proves tamper-evidence by editing an old ledger event directly and
 * showing verifyLedgerIntegrity() catch it.
 */
const { BlockchainAdapter, ROLES } = require('../src/adapter/BlockchainAdapter');

function line() {
  console.log('-'.repeat(70));
}

function main() {
  const chain = new BlockchainAdapter({ disputeTolerancePercent: 10 });

  // ---------------------------------------------------------------------
  // Flow 1: happy path — MATCHED -> LOCKED -> DELIVERED -> VERIFIED -> SETTLED
  // ---------------------------------------------------------------------
  line();
  console.log('FLOW 1: Trade #1001 — normal delivery, no dispute');
  line();

  chain.createTrade(
    {
      tradeId: 1001,
      buyer: 'consumer_zone2_alice',
      seller: 'prosumer_zone2_ravi',
      zoneId: 2,
      quantityKwh: 4.2,
      agreedPrice: 6.8,
    },
    ROLES.TRADING_ENGINE
  );
  console.log('createTrade ->', chain.getTrade(1001).status);

  chain.lockTrade(1001, ROLES.TRADING_ENGINE);
  console.log('lockTrade   ->', chain.getTrade(1001).status);

  const delivery1 = chain.recordDelivery(
    1001,
    { deliveredKwh: 4.1, meterReadings: [{ t: 1, kwh: 2.0 }, { t: 2, kwh: 2.1 }] },
    ROLES.METER_VERIFIER
  );
  console.log('recordDelivery -> status:', delivery1.trade.status, '| shortfall within tolerance');

  chain.settleTrade(1001, ROLES.SETTLEMENT_ENGINE);
  console.log('settleTrade ->', chain.getTrade(1001).status);

  console.log('\nAudit trail for trade 1001:');
  chain.getTradeHistory(1001).forEach((e) => {
    console.log(`  [${e.timestamp}] ${e.eventType}`, JSON.stringify(e.eventData));
  });

  // Duplicate settlement must be rejected
  try {
    chain.settleTrade(1001, ROLES.SETTLEMENT_ENGINE);
  } catch (err) {
    console.log('\nDuplicate settlement correctly rejected:', err.message);
  }

  // ---------------------------------------------------------------------
  // Flow 2: dispute path — shortfall beyond tolerance -> DISPUTED -> SETTLED
  // ---------------------------------------------------------------------
  line();
  console.log('FLOW 2: Trade #1002 — delivery shortfall triggers dispute');
  line();

  chain.createTrade(
    {
      tradeId: 1002,
      buyer: 'consumer_zone1_meera',
      seller: 'prosumer_zone1_sam',
      zoneId: 1,
      quantityKwh: 10,
      agreedPrice: 7.1,
    },
    ROLES.TRADING_ENGINE
  );
  chain.lockTrade(1002, ROLES.TRADING_ENGINE);

  const delivery2 = chain.recordDelivery(
    1002,
    { deliveredKwh: 8, meterReadings: [{ t: 1, kwh: 8 }] },
    ROLES.METER_VERIFIER
  );
  console.log('recordDelivery -> status:', delivery2.trade.status, '| shortfall:', chain.getTrade(1002).dispute.shortfallPercent + '%');

  chain.resolveDispute(1002, { refundAmount: 14.2, resolutionNote: '20% shortfall — partial refund per dispute rule' }, ROLES.ADMIN);
  const settled2 = chain.settleTrade(1002, ROLES.SETTLEMENT_ENGINE);
  console.log('settleTrade -> status:', settled2.trade.status, '| final amount:', settled2.trade.settlement.finalAmount);

  console.log('\nAudit trail for trade 1002:');
  chain.getTradeHistory(1002).forEach((e) => {
    console.log(`  [${e.timestamp}] ${e.eventType}`, JSON.stringify(e.eventData));
  });

  // Unauthorized role check
  try {
    chain.settleTrade(9999, ROLES.REGULATOR);
  } catch (err) {
    console.log('\nRegulator settlement attempt correctly rejected:', err.message);
  }

  // ---------------------------------------------------------------------
  // Ledger integrity check — before and after tampering
  // ---------------------------------------------------------------------
  line();
  console.log('LEDGER INTEGRITY');
  line();
  console.log('verifyLedgerIntegrity() before tampering:', chain.verifyLedgerIntegrity());

  // Simulate an admin with raw DB access trying to quietly rewrite history.
  const rawChain = chain.getFullLedger();
  const targetIndex = rawChain.findIndex((e) => e.eventType === 'TradeCreated' && e.tradeId === 1002);
  console.log(`\nTampering with event #${targetIndex} (TradeCreated for trade 1002) — changing agreedPrice...`);
  chain.ledger.chain[targetIndex].eventData.agreedPrice = 0.01; // altered without recomputing hashes

  console.log('verifyLedgerIntegrity() after tampering:', chain.verifyLedgerIntegrity());
  line();
}

main();
