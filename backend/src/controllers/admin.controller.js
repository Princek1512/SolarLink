const db = require('../services/db.service');
const auditService = require('../services/audit.service');
const { blockchainAdapter } = require('../services/engine.service');

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
exports.getAdminDashboard = async (req, res, next) => {
  try {
    // Trade aggregates
    const tradeStats = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'SETTLED') as settled,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled,
        COUNT(*) FILTER (WHERE status = 'DISPUTED') as disputed,
        COUNT(*) FILTER (WHERE status IN ('MATCHED','LOCKED','DELIVERED','VERIFIED')) as pending,
        COALESCE(SUM(quantity_kwh), 0) as total_kwh,
        COALESCE(SUM(quantity_kwh * agreed_price), 0) as total_value,
        CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(agreed_price)::numeric, 4) ELSE 0 END as avg_rate
      FROM trades
    `);

    const t = tradeStats.rows[0];
    const total = parseInt(t.total);
    const settled = parseInt(t.settled);
    const success_rate = total > 0 ? parseFloat(((settled / total) * 100).toFixed(1)) : 0;

    // Settlement aggregates
    const settlementStats = await db.query(`
      SELECT
        COALESCE(SUM(platform_fee), 0) as platform_fees,
        COALESCE(SUM(grid_fee), 0) as grid_fees,
        COALESCE(SUM(refund_amount), 0) as refunds,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_settlements,
        COUNT(*) FILTER (WHERE status = 'SETTLED') as completed_settlements
      FROM settlements
    `);
    const s = settlementStats.rows[0];

    // User counts
    const userStats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'prosumer' AND status = 'ACTIVE') as active_prosumers,
        COUNT(*) FILTER (WHERE role = 'consumer' AND status = 'ACTIVE') as active_consumers
      FROM users
    `);
    const u = userStats.rows[0];

    // Pending requests
    const reqStats = await db.query(`SELECT COUNT(*) as pending FROM user_requests WHERE status = 'PENDING'`);

    // Ledger integrity
    const ledgerValid = blockchainAdapter.verifyLedgerIntegrity();

    // Daily breakdown for last 30 days (chart data)
    const dailyTrades = await db.query(`
      SELECT
        DATE_TRUNC('day', created_at) as day,
        COUNT(*) as count,
        COALESCE(SUM(quantity_kwh), 0) as kwh,
        COALESCE(SUM(quantity_kwh * agreed_price), 0) as value,
        CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(agreed_price)::numeric, 4) ELSE 0 END as avg_rate
      FROM trades
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day ASC
    `);

    // Zone breakdown
    const zoneBreakdown = await db.query(`
      SELECT
        t.zone_id,
        gz.name as zone_name,
        COUNT(*) as trade_count,
        COALESCE(SUM(t.quantity_kwh), 0) as total_kwh,
        gz.current_load_kw,
        gz.capacity_kw,
        gz.status as zone_status
      FROM trades t
      JOIN grid_zones gz ON t.zone_id = gz.id
      GROUP BY t.zone_id, gz.name, gz.current_load_kw, gz.capacity_kw, gz.status
      ORDER BY trade_count DESC
    `);

    // Status distribution
    const statusDist = await db.query(`
      SELECT status, COUNT(*) as count FROM trades GROUP BY status ORDER BY count DESC
    `);

    res.json({
      total_trades: total,
      settled,
      cancelled: parseInt(t.cancelled),
      disputed: parseInt(t.disputed),
      pending: parseInt(t.pending),
      success_rate,
      total_kwh: parseFloat(t.total_kwh),
      total_value: parseFloat(t.total_value),
      avg_rate: parseFloat(t.avg_rate),
      platform_fees: parseFloat(s.platform_fees),
      grid_fees: parseFloat(s.grid_fees),
      refunds: parseFloat(s.refunds),
      pending_settlements: parseInt(s.pending_settlements),
      completed_settlements: parseInt(s.completed_settlements),
      active_prosumers: parseInt(u.active_prosumers),
      active_consumers: parseInt(u.active_consumers),
      pending_requests: parseInt(reqStats.rows[0].pending),
      ledger_valid: ledgerValid,
      chart_daily: dailyTrades.rows,
      chart_zones: zoneBreakdown.rows,
      chart_status: statusDist.rows
    });
  } catch (err) {
    next(err);
  }
};

// ─── User Requests ───────────────────────────────────────────────────────────
exports.getRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status.toUpperCase());
      where = `WHERE ur.status = $1`;
    }
    const result = await db.query(`
      SELECT
        ur.id, ur.user_id, ur.role, ur.zone_id, ur.asset_details,
        REGEXP_REPLACE(ur.status, '[''""]', '', 'g') as status,
        ur.reviewed_by, ur.review_reason, ur.created_at, ur.reviewed_at,
        u.name as user_name,
        u.email as user_email,
        rv.name as reviewed_by_name
      FROM user_requests ur
      JOIN users u ON ur.user_id = u.id
      LEFT JOIN users rv ON ur.reviewed_by = rv.id
      ${where}
      ORDER BY ur.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const reqRes = await db.query('SELECT * FROM user_requests WHERE id = $1', [id]);
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const request = reqRes.rows[0];

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request is not pending' });
    }

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE user_requests SET status = 'APPROVED', reviewed_by = $1, review_reason = $2, reviewed_at = NOW() WHERE id = $3`,
        [req.user.id, reason || null, id]
      );
      await client.query(
        `UPDATE users SET status = 'ACTIVE' WHERE id = $1`,
        [request.user_id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Audit
    await auditService.log(
      req.user.id, req.user.role,
      'USER_REQUEST_APPROVED', 'user_request', id,
      'APPROVED',
      { user_id: request.user_id, role: request.role, reason },
      req.ip
    );

    res.json({ message: 'Request approved', request_id: id });
  } catch (err) {
    next(err);
  }
};

exports.rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const reqRes = await db.query('SELECT * FROM user_requests WHERE id = $1', [id]);
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const request = reqRes.rows[0];

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request is not pending' });
    }

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE user_requests SET status = 'REJECTED', reviewed_by = $1, review_reason = $2, reviewed_at = NOW() WHERE id = $3`,
        [req.user.id, reason || null, id]
      );
      await client.query(`UPDATE users SET status = 'REJECTED' WHERE id = $1`, [request.user_id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await auditService.log(
      req.user.id, req.user.role,
      'USER_REQUEST_REJECTED', 'user_request', id,
      'REJECTED',
      { user_id: request.user_id, role: request.role, reason },
      req.ip
    );

    res.json({ message: 'Request rejected', request_id: id });
  } catch (err) {
    next(err);
  }
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { event_type, exclude_type, actor_role, entity_type, from, to, search, page = 1, limit = 50 } = req.query;
    const params = [];
    const conditions = [];
    let idx = 1;

    if (event_type) { conditions.push(`al.event_type = $${idx++}`); params.push(event_type); }
    if (exclude_type) { conditions.push(`al.event_type != $${idx++}`); params.push(exclude_type); }
    if (actor_role) { conditions.push(`al.actor_role = $${idx++}`); params.push(actor_role); }
    if (entity_type) { conditions.push(`al.entity_type = $${idx++}`); params.push(entity_type); }
    if (from) { conditions.push(`al.created_at >= $${idx++}`); params.push(from); }
    if (to) { conditions.push(`al.created_at <= $${idx++}`); params.push(to); }
    if (search) {
      conditions.push(`(al.event_type ILIKE $${idx} OR al.entity_id ILIKE $${idx} OR u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const result = await db.query(`
      SELECT
        al.*,
        u.name as actor_name,
        u.email as actor_email
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}
    `, params);

    const countParams = params.slice(0, params.length - 2);
    const countResult = await db.query(
      `SELECT COUNT(*) FROM audit_logs al LEFT JOIN users u ON al.actor_id = u.id ${where}`,
      countParams
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    next(err);
  }
};

// ─── Admin Trades ─────────────────────────────────────────────────────────────
exports.getAdminTrades = async (req, res, next) => {
  try {
    const { status } = req.query;
    let where = '';
    const params = [];
    if (status) {
      where = 'WHERE t.status = $1';
      params.push(status.toUpperCase());
    }
    const result = await db.query(`
      SELECT
        t.*,
        us.name as seller_name, us.email as seller_email, us.role as seller_role,
        ub.name as buyer_name, ub.email as buyer_email, ub.role as buyer_role,
        gz.name as zone_name,
        s.gross_amount, s.platform_fee, s.grid_fee, s.refund_amount,
        s.seller_credit, s.buyer_debit, s.status as settlement_status, s.settled_at,
        d.contracted_kwh, d.delivered_kwh, d.shortfall_percent, d.resolution
      FROM trades t
      JOIN users us ON t.seller_id = us.id
      JOIN users ub ON t.buyer_id = ub.id
      LEFT JOIN grid_zones gz ON t.zone_id = gz.id
      LEFT JOIN settlements s ON s.trade_id = t.id
      LEFT JOIN disputes d ON d.trade_id = t.id
      ${where}
      ORDER BY t.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// ─── Blockchain Ledger ────────────────────────────────────────────────────────
exports.getBlockchain = async (req, res, next) => {
  try {
    const ledgerValid = blockchainAdapter.verifyLedgerIntegrity();
    // Get all events from DB
    const events = await db.query(`
      SELECT
        te.*,
        t.seller_id, t.buyer_id, t.zone_id, t.quantity_kwh, t.agreed_price, t.status as trade_status
      FROM trade_events te
      JOIN trades t ON te.trade_id = t.id
      ORDER BY te.timestamp DESC
      LIMIT 200
    `);
    res.json({ ledger_valid: ledgerValid, events: events.rows });
  } catch (err) {
    next(err);
  }
};

// ─── Admin Users ──────────────────────────────────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.zone_id, u.status, u.created_at,
             gz.name as zone_name, w.balance as wallet_balance
      FROM users u
      LEFT JOIN grid_zones gz ON u.zone_id = gz.id
      LEFT JOIN wallets w ON w.user_id = u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};
