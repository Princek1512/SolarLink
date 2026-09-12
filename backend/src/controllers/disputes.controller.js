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
      
      // 1. Update disputes table
      await client.query(
        `UPDATE disputes SET resolution = $1, refund_amount = COALESCE($2, refund_amount) WHERE trade_id = $3`,
        [resolution, refund_amount, id]
      );
      
      // 2. Update trades status to SETTLED
      await client.query(
        `UPDATE trades SET status = 'SETTLED' WHERE id = $1`,
        [id]
      );

      // 3. Update settlements record if exists
      const setCheck = await client.query('SELECT id FROM settlements WHERE trade_id = $1', [id]);
      if (setCheck.rows.length > 0) {
        await client.query(
          `UPDATE settlements SET refund_amount = COALESCE($1, refund_amount), status = 'SETTLED', settled_at = NOW() WHERE trade_id = $2`,
          [refund_amount, id]
        );
      }
      
      // 4. Log to blockchain ledger
      let event;
      try {
        if (!blockchainAdapter.trades.has(id)) {
          // If not present in map, initialize trade structure
          const tradeRes = await client.query('SELECT * FROM trades WHERE id = $1', [id]);
          if (tradeRes.rows.length > 0) {
            const t = tradeRes.rows[0];
            blockchainAdapter.trades.set(id, {
              tradeId: id,
              buyer: t.buyer_id,
              seller: t.seller_id,
              quantityKwh: Number(t.quantity_kwh),
              agreedPrice: Number(t.agreed_price),
              totalAmount: Number(t.quantity_kwh) * Number(t.agreed_price),
              status: 'DISPUTED',
              dispute: { shortfallPercent: 10, refundAmount: 0 }
            });
          }
        }
        const resAdapter = blockchainAdapter.resolveDispute(id, { refundAmount: Number(refund_amount || 0), resolutionNote: resolution }, 'ADMIN');
        event = resAdapter.event;
      } catch (e) {
        // Fallback: direct event insertion into HashChainLedger
        event = blockchainAdapter.ledger.addEvent(id, 'DisputeResolved', {
          resolution,
          refundAmount: Number(refund_amount || 0)
        });
      }
      
      const currentHash = event.currentHash || event.eventHash || require('crypto').createHash('sha256').update(id + resolution).digest('hex');
      const prevHash = event.previousHash || '0'.repeat(64);

      await client.query(
        `INSERT INTO trade_events (trade_id, event_type, event_data, previous_hash, event_hash, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, event.eventType || 'DisputeResolved', JSON.stringify(event.eventData || { resolution, refund_amount }), prevHash, currentHash, event.timestamp || new Date()]
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

