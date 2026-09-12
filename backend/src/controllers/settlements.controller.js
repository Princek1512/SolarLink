const db = require('../services/db.service');
const { blockchainAdapter } = require('../services/engine.service');

exports.settleTrade = async (req, res, next) => {
  // Manual settlement trigger, normally done automatically via delivery verification
  try {
    const { tradeId } = req.params;
    
    // Call BlockchainAdapter.settleTrade
    const { trade, event } = blockchainAdapter.settleTrade(tradeId, 'SETTLEMENT_ENGINE');
    
    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      
      const tradeRes = await client.query('SELECT status FROM trades WHERE id = $1 FOR UPDATE', [tradeId]);
      if (!tradeRes.rows[0]) throw new Error('Trade not found');
      if (tradeRes.rows[0].status === 'SETTLED') {
        throw new Error('Trade is already settled');
      }
      
      // Update DB
      await client.query(`UPDATE trades SET status = $1 WHERE id = $2`, [trade.status, tradeId]);
      await client.query(`UPDATE settlements SET status = 'SETTLED', settled_at = $1 WHERE trade_id = $2`, [trade.settlement.settledAt, tradeId]);
      
      await client.query('COMMIT');
      res.json({ trade, event });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === 'DUPLICATE_SETTLEMENT') return res.status(409).json({ error: err.message });
    next(err);
  }
};
