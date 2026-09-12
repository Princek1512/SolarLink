const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../services/db.service');
const auditService = require('../services/audit.service');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey123';

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, zone_id } = req.body;
    
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['prosumer', 'consumer', 'utility', 'regulator'].includes(role)) {
      return res.status(403).json({ error: 'Invalid role for public registration' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Utility & Regulator roles require admin approval (PENDING). Consumer & Prosumer are auto-activated (ACTIVE).
    const requiresApproval = ['utility', 'regulator'].includes(role);
    const initialStatus = requiresApproval ? 'PENDING' : 'ACTIVE';

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash, role, zone_id, status) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, zone_id, status`,
        [name, email, password_hash, role, zone_id || null, initialStatus]
      );
      
      const user = result.rows[0];
      
      // Initialize wallet for new user
      await client.query(`INSERT INTO wallets (user_id, balance) VALUES ($1, 0)`, [user.id]);
      
      // Create user_request for admin review
      await client.query(
        `INSERT INTO user_requests (user_id, role, zone_id, status) VALUES ($1, $2, $3, $4)`,
        [user.id, role, zone_id || null, requiresApproval ? 'PENDING' : 'APPROVED']
      );
      
      await client.query('COMMIT');
      
      // Audit log
      auditService.log(user.id, role, 'USER_REGISTERED', 'user', user.id, initialStatus, { name, email, role, zone_id }, req.ip);
      
      res.status(201).json(user);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.constraint === 'users_email_key') {
        return res.status(409).json({ error: 'Email already in use' });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Enforce approval status for restricted roles
    if (user.status === 'PENDING') {
      return res.status(403).json({ 
        error: 'Your account registration request is pending admin approval. You will be able to log in once an administrator approves your account.' 
      });
    }

    if (user.status === 'REJECTED') {
      return res.status(403).json({ 
        error: 'Your registration request was rejected by the administrator. Access denied.' 
      });
    }

    const token = jwt.sign({ id: user.id, role: user.role, zone_id: user.zone_id }, JWT_SECRET, { expiresIn: '1d' });
    
    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password_hash;
    
    // Audit log — fire and forget
    auditService.log(user.id, user.role, 'USER_LOGIN', 'user', user.id, 'SUCCESS', { email }, req.ip);

    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, name, email, role, zone_id, status, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
