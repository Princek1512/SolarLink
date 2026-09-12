const db = require('../services/db.service');
const { congestionEngine } = require('../services/engine.service');

exports.getZones = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM grid_zones');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getZoneStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Ensure configured in CongestionEngine
    try {
      congestionEngine.getZoneConfig(id);
    } catch(e) {
      if (e.code === 'ZONE_NOT_CONFIGURED') {
        const zoneRes = await db.query('SELECT * FROM grid_zones WHERE id = $1', [id]);
        if (zoneRes.rows.length > 0) {
          const z = zoneRes.rows[0];
          congestionEngine.configureZone(id, {
            capacityKwh: parseFloat(z.capacity_kw),
            thresholdKwh: parseFloat(z.congestion_threshold)
          });
        }
      }
    }
    
    try {
      const status = congestionEngine.evaluate(id);
      res.json(status);
    } catch(e) {
      if (e.code === 'ZONE_NOT_CONFIGURED') return res.status(404).json({ error: 'Zone not found or not configured' });
      throw e;
    }
  } catch (err) {
    next(err);
  }
};

exports.updateZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, capacity_kw, congestion_threshold, throttled, curtailment_active } = req.body;
    
    // Ensure zone is configured in CongestionEngine before setting override
    if (status && ['NORMAL', 'ELEVATED', 'CONSTRAINED'].includes(status)) {
      try {
        congestionEngine.getZoneConfig(id);
      } catch (e) {
        if (e.code === 'ZONE_NOT_CONFIGURED') {
          const zoneRes = await db.query('SELECT * FROM grid_zones WHERE id = $1', [id]);
          if (zoneRes.rows.length > 0) {
            const z = zoneRes.rows[0];
            const cap = parseFloat(z.capacity_kw || 500);
            const thresh = Math.min(cap, parseFloat(z.congestion_threshold || cap * 0.8));
            congestionEngine.configureZone(id, {
              capacityKwh: cap,
              thresholdKwh: thresh
            });
          }
        }
      }
      try {
        congestionEngine.setOverride(id, status);
      } catch (e) {
        console.warn('CongestionEngine override warning:', e.message);
      }
    } else if (status === 'CLEAR') {
      try {
        congestionEngine.clearOverride(id);
      } catch (e) {}
    }
    
    const fields = [];
    const params = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      params.push(status);
    }
    if (capacity_kw !== undefined) {
      fields.push(`capacity_kw = $${idx++}`);
      params.push(capacity_kw);
    }
    if (congestion_threshold !== undefined) {
      fields.push(`congestion_threshold = $${idx++}`);
      params.push(congestion_threshold);
    }
    if (throttled !== undefined) {
      fields.push(`throttled = $${idx++}`);
      params.push(throttled);
    }
    if (curtailment_active !== undefined) {
      fields.push(`curtailment_active = $${idx++}`);
      params.push(curtailment_active);
    }

    if (fields.length === 0) {
      const current = await db.query('SELECT * FROM grid_zones WHERE id = $1', [id]);
      return res.json(current.rows[0]);
    }

    params.push(id);
    const query = `UPDATE grid_zones SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await db.query(query, params);
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};


