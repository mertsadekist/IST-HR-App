import jwt from 'jsonwebtoken';

/**
 * Refuses a request that is being made inside an impersonation session.
 *
 * "Login as" lets an admin operate an account to see and fix what its owner
 * sees, and every action taken is stamped in the audit trail with both
 * identities. Some actions are still not acceptable under a borrowed identity —
 * anything that hands the operator a secret belonging to that person, or that
 * would let them take the account over for good. Those refuse outright.
 */
export const denyImpersonated = (req, res, next) => {
  if (req.user?.imp) {
    return res.status(403).json({
      error: 'This action is not available while signed in as another user. Return to your own account first.',
    });
  }
  next();
};

export const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
