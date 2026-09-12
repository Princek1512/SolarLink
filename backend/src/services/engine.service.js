const path = require('path');
const { BlockchainAdapter, ROLES } = require('../../../blockchain/src/adapter/BlockchainAdapter');
const PricingEngine = require('../../../engines/pricing/src/engine/PricingEngine');
const CongestionEngine = require('../../../engines/congestion/src/engine/CongestionEngine');
const { LoadTracker } = require('../../../engines/congestion/src/engine/LoadTracker');
const PricingBridge = require('../../../engines/congestion/src/bridge/PricingBridge');
const SettlementEngine = require('../../../engines/settlement/src/engine/SettlementEngine');
const BlockchainBridge = require('../../../engines/settlement/src/bridge/BlockchainBridge');
const SimulatorManager = require('../../../engines/iot-meter/src/simulator/SimulatorManager');
const SurplusService = require('../../../engines/iot-meter/src/services/SurplusService');

// 1. Blockchain Adapter
const blockchainAdapter = new BlockchainAdapter();

// 2. Pricing Engine
const pricingEngine = new PricingEngine();
// Pseudo scheduler for pricing bridge
const pricingScheduler = {
  pushInputs: (zoneId, inputs) => {
    return pricingEngine.computeQuote(zoneId, inputs);
  }
};

// 3. Congestion Engine & Bridge
const loadTracker = new LoadTracker();
const congestionEngine = new CongestionEngine({ loadTracker });
const pricingBridge = new PricingBridge({
  congestionEngine,
  pricingScheduler,
  resolveTradeAllowed: (level) => level !== 'CONSTRAINED' // Simplified rule
});

// 4. Settlement Engine & Bridge
const settlementEngine = new SettlementEngine();
const settlementBridge = new BlockchainBridge({
  adapter: blockchainAdapter,
  settlementEngine
});

// 5. IoT Meter Simulator & Surplus Service
const simulatorManager = new SimulatorManager();
const surplusService = new SurplusService(simulatorManager);

module.exports = {
  blockchainAdapter,
  ROLES,
  pricingEngine,
  pricingScheduler,
  congestionEngine,
  loadTracker,
  pricingBridge,
  settlementEngine,
  settlementBridge,
  simulatorManager,
  surplusService
};
