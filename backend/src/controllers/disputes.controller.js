const db = require('../services/db.service');
const { blockchainAdapter } = require('../services/engine.service');

exports.getDisputes = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT d.*, t.status as trade_status 
      FROM disputes d
      JOIN trades t ON d.trade_id = t.id
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.resolveDispute = async (req, res, next) => {
  try {
    const { id } = req.params; // This is the trade_id
    const { resolution, refund_amount } = req.body;
    
    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      
      // Update the disputes table
      await client.query(
        `UPDATE disputes SET resolution = $1, refund_amount = COALESCE($2, refund_amount) WHERE trade_id = $3`,
        [resolution, refund_amount, id]
      );
      
      // Update trade status to SETTLED
      await client.query(
        `UPDATE trades SET status = 'SETTLED' WHERE id = $1`,
        [id]
      );
      
      // Log to blockchain
      const event = blockchainAdapter.recordEvent(id, 'DISPUTE_RESOLVED', {
        resolution,
        refund_amount
      }, 'REGULATOR');
      
      await client.query(
        `INSERT INTO trade_events (trade_id, event_type, event_data, previous_hash, event_hash, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, event.eventType, JSON.stringify(event.eventData), event.previousHash, event.eventHash, event.timestamp]
      );

      await client.query('COMMIT');
      res.json({ message: 'Dispute resolved successfully', event });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};
