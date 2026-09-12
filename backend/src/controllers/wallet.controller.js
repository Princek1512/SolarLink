const db = require('../services/db.service');
const auditService = require('../services/audit.service');

exports.getWallet = async (req, res, next) => {
  try {
    let result = await db.query('SELECT * FROM wallets WHERE user_id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      result = await db.query('INSERT INTO wallets (user_id, balance) VALUES ($1, $2) RETURNING *', [req.user.id, 0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    // For MVP, we'll derive transactions from settlements based on user role
    let query = '';
    let params = [req.user.id];
    
    if (req.user.role === 'prosumer') {
      query = `
        SELECT s.*, t.quantity_kwh, t.agreed_price 
        FROM settlements s
        JOIN trades t ON s.trade_id = t.id
        WHERE t.seller_id = $1
        ORDER BY s.settled_at DESC
      `;
    } else if (req.user.role === 'consumer') {
      query = `
        SELECT s.*, t.quantity_kwh, t.agreed_price 
        FROM settlements s
        JOIN trades t ON s.trade_id = t.id
        WHERE t.buyer_id = $1
        ORDER BY s.settled_at DESC
      `;
    } else {
      return res.status(403).json({ error: 'Role does not have standard transactions' });
    }
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.requestDeposit = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    
    const result = await db.query(
      `INSERT INTO wallet_deposits (user_id, amount) VALUES ($1, $2) RETURNING *`,
      [req.user.id, amount]
    );
    auditService.log(req.user.id, req.user.role, 'DEPOSIT_REQUESTED', 'wallet_deposit', result.rows[0].id, 'PENDING', { amount }, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getDeposits = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT d.*, u.name, u.email, u.role 
      FROM wallet_deposits d
      JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.approveDeposit = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      
      const depositRes = await client.query('SELECT * FROM wallet_deposits WHERE id = $1 AND status = $2', [id, 'PENDING']);
      if (depositRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Pending deposit not found' });
      }
      const deposit = depositRes.rows[0];
      
      await client.query('UPDATE wallet_deposits SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3', ['APPROVED', req.user.id, id]);
      await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2', [deposit.amount, deposit.user_id]);
      
      await client.query('COMMIT');
      auditService.log(req.user.id, req.user.role, 'DEPOSIT_APPROVED', 'wallet_deposit', id, 'APPROVED', { amount: deposit.amount, user_id: deposit.user_id }, req.ip);
      res.json({ message: 'Deposit approved successfully' });
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

exports.rejectDeposit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const depositRes = await db.query('SELECT * FROM wallet_deposits WHERE id = $1 AND status = $2', [id, 'PENDING']);
    if (depositRes.rows.length === 0) return res.status(404).json({ error: 'Pending deposit not found' });
    
    await db.query(
      `UPDATE wallet_deposits SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
      ['REJECTED', req.user.id, id]
    );
    auditService.log(req.user.id, req.user.role, 'DEPOSIT_REJECTED', 'wallet_deposit', id, 'REJECTED', { reason }, req.ip);
    res.json({ message: 'Deposit request rejected' });
  } catch (err) {
    next(err);
  }
};
