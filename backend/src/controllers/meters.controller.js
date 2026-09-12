const db = require('../services/db.service');
const { simulatorManager, surplusService } = require('../services/engine.service');

exports.simulateReading = async (req, res, next) => {
  try {
    const { id } = req.params; // meter_id
    
    // Get meter and asset to verify ownership
    const meterRes = await db.query('SELECT * FROM smart_meters WHERE id = $1', [id]);
    if (meterRes.rows.length === 0) return res.status(404).json({ error: 'Meter not found' });
    const meter = meterRes.rows[0];
    
    const assetRes = await db.query('SELECT * FROM solar_assets WHERE id = $1', [meter.asset_id]);
    const asset = assetRes.rows[0];
    if (req.user.role === 'prosumer' && asset.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Trigger simulator
    const reading = await simulatorManager.tickOnce(asset.id, new Date());
    
    // Persist reading
    const result = await db.query(
      `INSERT INTO meter_readings (meter_id, generation_kwh, consumption_kwh, battery_charge_kwh, battery_discharge_kwh)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, reading.generationKwh, reading.consumptionKwh, reading.batteryChargeKwh, reading.batteryDischargeKwh]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getLatestReading = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Simplified auth check
    const result = await db.query(
      'SELECT * FROM meter_readings WHERE meter_id = $1 ORDER BY timestamp DESC LIMIT 1',
      [id]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'No readings found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getReadings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM meter_readings WHERE meter_id = $1 ORDER BY timestamp DESC LIMIT 50',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};
