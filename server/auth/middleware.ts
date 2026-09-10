import type { Request, Response, NextFunction } from 'express';
import type { Role } from '../models/domain';
import { getSession } from './auth';

declare global { namespace Express { interface Request { user?: import('../models/domain').User } } }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Authentication required' });
  req.user = session.user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}
