const db = require('../services/db.service');
const { pricingEngine } = require('../services/engine.service');

exports.getQuote = async (req, res, next) => {
  try {
    const { zoneId, quantity } = req.query;
    if (!zoneId || !quantity) return res.status(400).json({ error: 'zoneId and quantity are required' });
    
    // In real scenario, we'd get current supply and demand.
    // For quote, we just ask PricingEngine to compute based on current known supply/demand or provided.
    // Let's get real supply/demand:
    const { surplusService } = require('../services/engine.service');
    const demandRes = await db.query(`SELECT COALESCE(SUM(quantity_kwh), 0) as total FROM buy_orders WHERE status = 'ACTIVE' AND zone_id = $1`, [zoneId]);
    const demandKwh = parseFloat(demandRes.rows[0].total) + parseFloat(quantity); // Include requested qty in demand
    
    const zoneSummaries = surplusService.getZoneSummaries();
    const zoneSummary = zoneSummaries.find(z => z.zoneId === zoneId) || { totalAvailableKwh: 0 };
    const supplyKwh = zoneSummary.totalAvailableKwh;

    // Make sure zone is configured in PricingEngine
    // In a real app we'd load configs from DB on startup. Let's lazily configure it if missing.
    try {
      pricingEngine.getZoneConfig(zoneId);
    } catch (e) {
      if (e.code === 'ZONE_NOT_CONFIGURED') {
        const configRes = await db.query('SELECT * FROM pricing_configs WHERE zone_id = $1', [zoneId]);
        if (configRes.rows.length > 0) {
          const cfg = configRes.rows[0];
          pricingEngine.configureZone(zoneId, {
            floor: parseFloat(cfg.floor_price),
            ceiling: parseFloat(cfg.ceiling_price),
            elasticityFactor: parseFloat(cfg.elasticity_factor),
            repricingIntervalMs: parseInt(cfg.repricing_interval)
          });
        }
      }
    }

    try {
      const quote = pricingEngine.computeQuote(zoneId, { supplyKwh, demandKwh, congestionLevel: 'NORMAL' }); // Congestion could be fetched from CongestionEngine
      res.json(quote);
    } catch (e) {
      if (e.code === 'ZONE_NOT_CONFIGURED') return res.status(404).json({ error: 'Zone pricing not configured' });
      throw e;
    }
  } catch (err) {
    next(err);
  }
};

exports.getConfig = async (req, res, next) => {
  try {
    const { zoneId } = req.params;
    const result = await db.query('SELECT * FROM pricing_configs WHERE zone_id = $1', [zoneId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Config not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const { zoneId } = req.params;
    const { floor_price, ceiling_price, elasticity_factor } = req.body;
    
    const result = await db.query(
      `UPDATE pricing_configs SET 
       floor_price = COALESCE($1, floor_price), 
       ceiling_price = COALESCE($2, ceiling_price),
       elasticity_factor = COALESCE($3, elasticity_factor)
       WHERE zone_id = $4 RETURNING *`,
      [floor_price, ceiling_price, elasticity_factor, zoneId]
    );
    
    if (result.rows.length > 0) {
      const cfg = result.rows[0];
      pricingEngine.configureZone(zoneId, {
        floor: parseFloat(cfg.floor_price),
        ceiling: parseFloat(cfg.ceiling_price),
        elasticityFactor: parseFloat(cfg.elasticity_factor)
      });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
