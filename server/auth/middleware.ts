import type { Request, Response, NextFunction } from 'express';
import type { Role } from '../models/domain.ts';
import { getUserFromToken } from './auth.ts';

declare global {
  namespace Express {
    interface Request { user?: import('../models/domain.ts').User }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authorization = req.headers?.authorization;
    const token = typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/i, '') : undefined;
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
