import type { Request, Response, NextFunction } from 'express';
import type { Role } from '../models/domain';
import { getUserFromToken } from './auth';

declare global {
  namespace Express {
    interface Request { user?: import('../models/domain').User }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    req.user = user;
    return next();
  } catch (error) {
    console.error(error);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}
