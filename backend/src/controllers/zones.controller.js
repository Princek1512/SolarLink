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
    const { status, capacity_kw, congestion_threshold } = req.body;
    
    // We can also use CongestionEngine's setOverride if 'status' is CONSTRAINED/NORMAL etc.
    if (status && ['NORMAL', 'ELEVATED', 'CONSTRAINED'].includes(status)) {
      congestionEngine.setOverride(id, status);
    } else if (status === 'CLEAR') {
      congestionEngine.clearOverride(id);
    }
    
    const result = await db.query(
      `UPDATE grid_zones SET 
       status = COALESCE($1, status),
       capacity_kw = COALESCE($2, capacity_kw),
       congestion_threshold = COALESCE($3, congestion_threshold)
       WHERE id = $4 RETURNING *`,
      [status, capacity_kw, congestion_threshold, id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
