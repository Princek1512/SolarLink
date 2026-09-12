/**
 * BlockchainBridge
 *
 * Wires SettlementEngine to solarlink-blockchain's BlockchainAdapter
 * lifecycle, matching the state diagram in SETTLEMENT_DISPUTE.md:
 *
 *   LOCKED -> DELIVERED -> Verification -> Shortfall?
 *                                   No -> SETTLED
 *                                   Yes -> DISPUTED -> Partial Refund -> SETTLED
 *
 * `adapter` is injected (not require()'d) — same reasoning as
 * solarlink-congestion-engine's PricingBridge: this repo has no hard path
 * dependency on where solarlink-blockchain lives on disk. It only needs an
 * object shaped like BlockchainAdapter:
 *   recordDelivery(tradeId, { deliveredKwh, meterReadings }, actorRole)
 *   resolveDispute(tradeId, { refundAmount, resolutionNote }, actorRole)
 *   settleTrade(tradeId, actorRole)
 *
 * Role strings are passed as plain literals matching BlockchainAdapter's
 * own ROLES enum values, rather than importing it directly, for the same
 * no-hard-dependency reason.
 */
class BlockchainBridge {
  constructor({ adapter, settlementEngine, disputeTolerancePercent }) {
    if (!adapter || !settlementEngine) {
      throw new Error('BlockchainBridge requires adapter and settlementEngine');
    }
    this.adapter = adapter;
    this.settlementEngine = settlementEngine;
    // Default to the adapter's own configured tolerance if it exposes one
    // (BlockchainAdapter does, as a plain instance property) so the
    // adapter's internal VERIFIED/DISPUTED decision in recordDelivery()
    // and this bridge's settlement-side isDisputed decision can never
    // disagree. Pass an explicit value only to intentionally diverge.
    this.disputeTolerancePercent = disputeTolerancePercent ?? adapter.disputeTolerancePercent ?? 10;
  }

  /**
   * finalizeDelivery — the single call site for the whole
   * DELIVERED -> Verification -> Shortfall? -> SETTLED/DISPUTED->SETTLED
   * flow. Call this once meter verification data is ready; it drives the
   * adapter through every remaining state transition and returns the
   * settlement numbers (gross/fees/refund/prosumer_credit/consumer_debit)
   * for the backend to apply to wallets (TRADING_FLOW.md's "Wallet
   * Updates" step — this bridge computes the numbers, it does not touch a
   * wallet store itself).
   */
  finalizeDelivery(tradeId, { deliveredKwh, meterReadings = [] }) {
    const { trade: deliveredTrade } = this.adapter.recordDelivery(
      tradeId,
      { deliveredKwh, meterReadings },
      'METER_VERIFIER'
    );

    const settlement = this.settlementEngine.computeSettlement({
      tradeId,
      zoneId: deliveredTrade.zoneId ?? undefined,
      quantityKwh: deliveredTrade.quantityKwh,
      agreedPrice: deliveredTrade.agreedPrice,
      // Compute shortfall from the raw delivered figure ourselves (same
      // formula as DisputeCalculator/the adapter) rather than reading
      // deliveredTrade.dispute.shortfallPercent — that field is null on the
      // non-disputed path, which would otherwise misreport a small
      // under-tolerance shortfall as exactly 0.
      contractedKwh: deliveredTrade.quantityKwh,
      deliveredKwh,
      tolerancePercent: this.disputeTolerancePercent,
    });

    let finalTrade = deliveredTrade;

    if (settlement.isDisputed) {
      ({ trade: finalTrade } = this.adapter.resolveDispute(
        tradeId,
        {
          refundAmount: settlement.refund,
          resolutionNote: `Shortfall ${settlement.shortfallPercent}% exceeds ${this.disputeTolerancePercent}% tolerance — proportional refund applied.`,
        },
        'ADMIN'
      ));
    }

    ({ trade: finalTrade } = this.adapter.settleTrade(tradeId, 'SETTLEMENT_ENGINE'));

    return {
      trade: finalTrade,
      settlement,
      walletUpdate: {
        tradeId,
        prosumerId: finalTrade.seller,
        consumerId: finalTrade.buyer,
        prosumerCredit: settlement.prosumerCredit,
        consumerDebit: settlement.consumerDebit,
        platformFee: settlement.fees.platformFee,
        gridFee: settlement.fees.gridFee,
        refund: settlement.refund,
      },
    };
  }
}

module.exports = BlockchainBridge;
