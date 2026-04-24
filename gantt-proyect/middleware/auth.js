const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev_secret_change_in_production') {
  console.error('FATAL: JWT_SECRET is not set. Set a strong secret in the JWT_SECRET environment variable.');
  process.exit(1);
}

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

async function requireOrganization(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const orgIdHeader = req.headers['x-organization-id'];
  if (!orgIdHeader) {
    return res.status(400).json({ error: 'X-Organization-ID header is required' });
  }

  const organizationId = parseInt(orgIdHeader, 10);
  if (isNaN(organizationId)) {
    return res.status(400).json({ error: 'Invalid Organization ID' });
  }

  const { getRepos } = require('../repositories');
  const { organizations } = getRepos();

  try {
    const membership = await organizations.isUserMember(req.user.id, organizationId);
    if (!membership) {
      return res.status(403).json({ error: 'Access denied to this organization' });
    }

    req.organization = {
      id: organizationId,
      role: membership.role
    };
    next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { requireAuth, requireRole, requireOrganization, JWT_SECRET };
