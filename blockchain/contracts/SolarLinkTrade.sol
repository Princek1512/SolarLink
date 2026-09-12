// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SolarLinkTrade
 *
 * On-chain trade integrity/audit layer for SolarLink (BLOCKCHAIN_DESIGN.md §7-10).
 * This contract does NOT calculate pricing, matching, or surplus — it only
 * records the result of those off-chain decisions and enforces that trade
 * state transitions happen in a valid order, and only via authorized roles.
 *
 * Deploy to a testnet (Polygon Amoy / Sepolia) only after the hash-chain
 * flow (Priority 1 + 2) is already working end to end.
 */
contract SolarLinkTrade {
    enum TradeStatus {
        NONE, // default zero-value, used to detect "trade does not exist"
        MATCHED,
        LOCKED,
        DELIVERED,
        VERIFIED,
        SETTLED,
        DISPUTED,
        CANCELLED
    }

    struct Trade {
        uint256 tradeId;
        address buyer;
        address seller;
        uint256 zoneId;
        uint256 quantityKwh;
        uint256 agreedPrice;
        uint256 totalAmount;
        uint256 createdAt;
        uint256 deliveredKwh;
        bytes32 meterDataHash;
        TradeStatus status;
    }

    // ---- Roles (design doc §10) ----
    address public admin;
    mapping(address => bool) public isTradingEngine;
    mapping(address => bool) public isSettlementEngine;
    mapping(address => bool) public isMeterVerifier;
    mapping(address => bool) public isRegulator; // read-only in practice; no state-changing rights granted

    mapping(uint256 => Trade) public trades;

    uint256 public disputeToleranceBps = 1000; // 10.00% expressed in basis points

    event TradeCreated(
        uint256 indexed tradeId,
        address indexed buyer,
        address indexed seller,
        uint256 quantityKwh,
        uint256 agreedPrice
    );
    event TradeLocked(uint256 indexed tradeId);
    event TradeCancelled(uint256 indexed tradeId, string reason);
    event DeliveryRecorded(uint256 indexed tradeId, uint256 deliveredKwh, bytes32 meterDataHash);
    event TradeVerified(uint256 indexed tradeId, uint256 shortfallBps);
    event DisputeRaised(uint256 indexed tradeId, uint256 shortfallBps);
    event DisputeResolved(uint256 indexed tradeId, uint256 refundAmount, string note);
    event TradeSettled(uint256 indexed tradeId, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "SolarLinkTrade: caller is not admin");
        _;
    }

    modifier onlyTradingEngine() {
        require(isTradingEngine[msg.sender] || msg.sender == admin, "SolarLinkTrade: not authorized (trading engine)");
        _;
    }

    modifier onlySettlementEngine() {
        require(isSettlementEngine[msg.sender] || msg.sender == admin, "SolarLinkTrade: not authorized (settlement engine)");
        _;
    }

    modifier onlyMeterVerifier() {
        require(isMeterVerifier[msg.sender] || msg.sender == admin, "SolarLinkTrade: not authorized (meter verifier)");
        _;
    }

    modifier tradeExists(uint256 tradeId) {
        require(trades[tradeId].status != TradeStatus.NONE, "SolarLinkTrade: trade does not exist");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // ---- Admin: role management ----

    function setTradingEngine(address account, bool allowed) external onlyAdmin {
        isTradingEngine[account] = allowed;
    }

    function setSettlementEngine(address account, bool allowed) external onlyAdmin {
        isSettlementEngine[account] = allowed;
    }

    function setMeterVerifier(address account, bool allowed) external onlyAdmin {
        isMeterVerifier[account] = allowed;
    }

    function setRegulator(address account, bool allowed) external onlyAdmin {
        isRegulator[account] = allowed;
    }

    function setDisputeToleranceBps(uint256 bps) external onlyAdmin {
        require(bps <= 10000, "SolarLinkTrade: tolerance cannot exceed 100%");
        disputeToleranceBps = bps;
    }

    // ---- Core lifecycle ----

    function createTrade(
        uint256 tradeId,
        address buyer,
        address seller,
        uint256 zoneId,
        uint256 quantityKwh,
        uint256 agreedPrice
    ) external onlyTradingEngine {
        require(trades[tradeId].status == TradeStatus.NONE, "SolarLinkTrade: duplicate trade");
        require(buyer != address(0) && seller != address(0), "SolarLinkTrade: invalid parties");
        require(quantityKwh > 0 && agreedPrice > 0, "SolarLinkTrade: invalid quantity/price");

        uint256 totalAmount = quantityKwh * agreedPrice;

        trades[tradeId] = Trade({
            tradeId: tradeId,
            buyer: buyer,
            seller: seller,
            zoneId: zoneId,
            quantityKwh: quantityKwh,
            agreedPrice: agreedPrice,
            totalAmount: totalAmount,
            createdAt: block.timestamp,
            deliveredKwh: 0,
            meterDataHash: bytes32(0),
            status: TradeStatus.MATCHED
        });

        emit TradeCreated(tradeId, buyer, seller, quantityKwh, agreedPrice);
    }

    function lockTrade(uint256 tradeId) external onlyTradingEngine tradeExists(tradeId) {
        Trade storage t = trades[tradeId];
        require(t.status == TradeStatus.MATCHED, "SolarLinkTrade: invalid transition, expected MATCHED");
        t.status = TradeStatus.LOCKED;
        emit TradeLocked(tradeId);
    }

    function cancelTrade(uint256 tradeId, string calldata reason)
        external
        onlyTradingEngine
        tradeExists(tradeId)
    {
        Trade storage t = trades[tradeId];
        require(
            t.status == TradeStatus.MATCHED || t.status == TradeStatus.LOCKED,
            "SolarLinkTrade: can only cancel before delivery"
        );
        t.status = TradeStatus.CANCELLED;
        emit TradeCancelled(tradeId, reason);
    }

    /**
     * verifyDelivery — records delivered kWh + a hash of the off-chain meter
     * data used to compute it, then auto-transitions to VERIFIED or DISPUTED
     * based on shortfall vs disputeToleranceBps (design doc §13/§20).
     */
    function verifyDelivery(
        uint256 tradeId,
        uint256 deliveredKwh,
        bytes32 meterDataHash
    ) external onlyMeterVerifier tradeExists(tradeId) {
        Trade storage t = trades[tradeId];
        require(t.status == TradeStatus.LOCKED, "SolarLinkTrade: invalid transition, expected LOCKED");

        t.status = TradeStatus.DELIVERED;
        t.deliveredKwh = deliveredKwh;
        t.meterDataHash = meterDataHash;
        emit DeliveryRecorded(tradeId, deliveredKwh, meterDataHash);

        uint256 shortfallBps = 0;
        if (deliveredKwh < t.quantityKwh) {
            shortfallBps = ((t.quantityKwh - deliveredKwh) * 10000) / t.quantityKwh;
        }

        if (shortfallBps > disputeToleranceBps) {
            t.status = TradeStatus.DISPUTED;
            emit DisputeRaised(tradeId, shortfallBps);
        } else {
            t.status = TradeStatus.VERIFIED;
            emit TradeVerified(tradeId, shortfallBps);
        }
    }

    function resolveDispute(
        uint256 tradeId,
        uint256 refundAmount,
        string calldata note
    ) external onlySettlementEngine tradeExists(tradeId) {
        Trade storage t = trades[tradeId];
        require(t.status == TradeStatus.DISPUTED, "SolarLinkTrade: trade is not disputed");
        require(refundAmount <= t.totalAmount, "SolarLinkTrade: refund exceeds trade amount");
        // Refund amount is stored implicitly via the settle step; emit for audit trail now.
        emit DisputeResolved(tradeId, refundAmount, note);
        t.totalAmount = t.totalAmount - refundAmount;
    }

    function settleTrade(uint256 tradeId) external onlySettlementEngine tradeExists(tradeId) {
        Trade storage t = trades[tradeId];
        require(
            t.status == TradeStatus.VERIFIED || t.status == TradeStatus.DISPUTED,
            "SolarLinkTrade: trade must be VERIFIED or DISPUTED to settle"
        );
        require(t.status != TradeStatus.SETTLED, "SolarLinkTrade: duplicate settlement rejected");

        t.status = TradeStatus.SETTLED;
        emit TradeSettled(tradeId, t.totalAmount);
    }

    // ---- Read-only ----

    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }
}
