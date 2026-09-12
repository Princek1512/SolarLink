const crypto = require('crypto');

/**
 * HashChainLedger
 *
 * Append-only, tamper-evident event log. Each event's hash is derived from
 * its own data plus the previous event's hash, so editing any historical
 * event (even changing one character) changes that event's hash and breaks
 * every link after it. verifyChain() walks the whole chain and reports
 * exactly where it broke.
 *
 * This is the "Option A" fallback described in BLOCKCHAIN_LEDGER.md /
 * BLOCKCHAIN_DESIGN.md §14, meant to sit behind BlockchainAdapter so the
 * rest of the app never talks to it directly.
 */
class HashChainLedger {
  constructor() {
    this.chain = [];
    this._seedGenesis();
  }

  _seedGenesis() {
    const genesis = {
      eventId: 0,
      tradeId: null,
      eventType: 'GENESIS',
      timestamp: new Date(0).toISOString(),
      eventData: { note: 'SolarLink ledger genesis block' },
      previousHash: '0'.repeat(64),
    };
    genesis.currentHash = this._computeHash(genesis);
    this.chain.push(genesis);
  }

  _computeHash({ previousHash, eventType, eventData, timestamp }) {
    const payload = previousHash + eventType + JSON.stringify(eventData) + timestamp;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Append a new event to the chain.
   * @param {string|number} tradeId
   * @param {string} eventType e.g. 'TradeCreated', 'TradeLocked', 'DeliveryRecorded'
   * @param {object} eventData arbitrary event payload (kept small — see design doc §21)
   */
  addEvent(tradeId, eventType, eventData = {}) {
    const previous = this.chain[this.chain.length - 1];
    const event = {
      eventId: this.chain.length,
      tradeId,
      eventType,
      timestamp: new Date().toISOString(),
      eventData,
      previousHash: previous.currentHash,
    };
    event.currentHash = this._computeHash(event);
    this.chain.push(event);
    return { ...event };
  }

  /** All events for a given trade, in order — the audit trail for the UI. */
  getHistory(tradeId) {
    return this.chain.filter((e) => e.tradeId === tradeId).map((e) => ({ ...e }));
  }

  /** The entire ledger, including the genesis block. */
  getFullChain() {
    return this.chain.map((e) => ({ ...e }));
  }

  /**
   * Recomputes every hash and compares it to what's stored, and checks that
   * each block's previousHash actually matches the prior block's currentHash.
   * This is what makes tampering detectable: silently editing eventData,
   * eventType, or timestamp on an old block invalidates its stored hash and
   * every block chained after it.
   */
  verifyChain() {
    for (let i = 0; i < this.chain.length; i += 1) {
      const block = this.chain[i];
      const expectedHash = this._computeHash(block);
      if (expectedHash !== block.currentHash) {
        return {
          valid: false,
          brokenAtIndex: i,
          eventId: block.eventId,
          reason: 'currentHash does not match recomputed hash — event data was altered',
        };
      }
      if (i > 0 && block.previousHash !== this.chain[i - 1].currentHash) {
        return {
          valid: false,
          brokenAtIndex: i,
          eventId: block.eventId,
          reason: 'previousHash does not match the prior block\'s currentHash — chain link broken',
        };
      }
    }
    return { valid: true, length: this.chain.length };
  }
}

module.exports = HashChainLedger;
