/**
 * SolidityAdapter — Priority 3 upgrade path (BLOCKCHAIN_DESIGN.md §24).
 *
 * This exposes the EXACT same method names/shapes as BlockchainAdapter
 * (createTrade, lockTrade, recordDelivery, settleTrade, resolveDispute,
 * getTradeHistory, verifyLedgerIntegrity) so the rest of the backend never
 * needs to know which one it's talking to. Only wire this up if the hash-
 * chain flow (Priority 1 + 2) is already demoed and working end to end —
 * don't risk the demo chasing a testnet deployment.
 *
 * Not wired to a live network here (this sandbox has no outbound network
 * access), but this is the shape you'd fill in with ethers.js:
 *
 *   npm install ethers
 *
 * and the ABI generated from contracts/SolarLinkTrade.sol (e.g. via Hardhat:
 * npx hardhat compile, then read artifacts/.../SolarLinkTrade.json).
 */

// const { ethers } = require('ethers');
// const abi = require('../../contracts/abi/SolarLinkTrade.json').abi;

class SolidityAdapter {
  constructor({ rpcUrl, contractAddress, signerPrivateKey } = {}) {
    if (!rpcUrl || !contractAddress || !signerPrivateKey) {
      throw new Error(
        'SolidityAdapter requires rpcUrl, contractAddress, and signerPrivateKey. ' +
          'Deploy contracts/SolarLinkTrade.sol to a testnet (e.g. Polygon Amoy or Sepolia) first — see contracts/README notes.'
      );
    }
    // this.provider = new ethers.JsonRpcProvider(rpcUrl);
    // this.wallet = new ethers.Wallet(signerPrivateKey, this.provider);
    // this.contract = new ethers.Contract(contractAddress, abi, this.wallet);
    throw new Error('SolidityAdapter is a scaffold — uncomment the ethers.js wiring above once a contract is deployed.');
  }

  async createTrade({ tradeId, buyer, seller, zoneId, quantityKwh, agreedPrice }) {
    // const tx = await this.contract.createTrade(tradeId, buyer, seller, zoneId, quantityKwh, agreedPrice);
    // return tx.wait();
    throw new Error('not implemented — see class docstring');
  }

  async lockTrade(tradeId) {
    // const tx = await this.contract.lockTrade(tradeId);
    // return tx.wait();
    throw new Error('not implemented — see class docstring');
  }

  async recordDelivery(tradeId, { deliveredKwh, meterDataHash }) {
    // const tx = await this.contract.verifyDelivery(tradeId, deliveredKwh, meterDataHash);
    // return tx.wait();
    throw new Error('not implemented — see class docstring');
  }

  async settleTrade(tradeId) {
    // const tx = await this.contract.settleTrade(tradeId);
    // return tx.wait();
    throw new Error('not implemented — see class docstring');
  }

  async raiseDispute(tradeId) {
    // const tx = await this.contract.raiseDispute(tradeId);
    // return tx.wait();
    throw new Error('not implemented — see class docstring');
  }

  async getTradeHistory(tradeId) {
    // Read TradeCreated/TradeLocked/... events filtered by tradeId via
    // this.contract.queryFilter(...) and merge/sort by block number.
    throw new Error('not implemented — see class docstring');
  }
}

module.exports = SolidityAdapter;
