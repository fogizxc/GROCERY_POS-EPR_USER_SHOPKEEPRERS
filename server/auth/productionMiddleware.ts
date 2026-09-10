import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';
import { users } from '../store/memoryStore';

declare global { namespace Express { interface Request { authUser?: import('../models/domain').User } } }

export function requireJwt(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const claims = verifyToken(token);
  const user = claims && users.find(u => u.id === claims.sub && u.active);
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
  req.authUser = user;
  next();
}
