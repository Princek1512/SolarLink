const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey123';

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Failed to authenticate token' });
    }
    req.user = decoded; // { id, role }
    next();
  });
};

const optionalToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err) {
      req.user = decoded;
    }
    next();
  });
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires one of roles: ${roles.join(', ')}` });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  optionalToken,
  requireRole
};
