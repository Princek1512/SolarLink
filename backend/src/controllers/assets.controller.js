const db = require('../services/db.service');

exports.createAsset = async (req, res, next) => {
  try {
    const { capacity_kw, panel_details, inverter_details, battery_enabled } = req.body;
    
    const result = await db.query(
      `INSERT INTO solar_assets (user_id, capacity_kw, panel_details, inverter_details, battery_enabled) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, capacity_kw, panel_details, inverter_details, battery_enabled || false]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM solar_assets WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    const asset = result.rows[0];
    if (req.user.role === 'prosumer' && asset.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Not your asset' });
    }
    
    res.json(asset);
  } catch (err) {
    next(err);
  }
};

exports.createMeter = async (req, res, next) => {
  try {
    const { id } = req.params; // asset_id
    
    // Verify asset ownership
    const assetRes = await db.query('SELECT * FROM solar_assets WHERE id = $1', [id]);
    if (assetRes.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    if (req.user.role === 'prosumer' && assetRes.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const meter_type = 'PROSUMER';
    const result = await db.query(
      `INSERT INTO smart_meters (asset_id, meter_type) VALUES ($1, $2) RETURNING *`,
      [id, meter_type]
    );
    
    const meter = result.rows[0];
    
    // Register with simulator
    const { simulatorManager } = require('../services/engine.service');
    const asset = assetRes.rows[0];
    // Need user's zone
    const userRes = await db.query('SELECT zone_id FROM users WHERE id = $1', [asset.user_id]);
    const zone_id = userRes.rows[0].zone_id;
    
    simulatorManager.registerMeter({
      assetId: asset.id,
      zoneId: zone_id,
      type: 'PROSUMER',
      capacityKw: parseFloat(asset.capacity_kw),
      hasBattery: asset.battery_enabled,
      batteryCapacityKwh: asset.battery_enabled ? parseFloat(asset.capacity_kw) * 2 : 0, // Mock assumption
      batteryChargeKwh: 0,
      scenario: 'SUNNY'
    });
    
    res.status(201).json(meter);
  } catch (err) {
    next(err);
  }
};
