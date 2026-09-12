const db = require('../services/db.service');

exports.getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Prosumers/Consumers can only view themselves; Admins/Regulators can view anyone
    if (req.user.role === 'prosumer' || req.user.role === 'consumer') {
      if (req.user.id !== id) {
        return res.status(403).json({ error: 'Forbidden: Cannot view other users' });
      }
    }

    const result = await db.query('SELECT id, name, email, role, zone_id, status, created_at FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
