import type { Request, Response, NextFunction } from 'express';
import { connectMongo } from '../../server/db/mongodb.ts';
import { auth } from '../../server/routes/auth.ts';

let mongoReady: Promise<unknown> | null = null;

export default async function handler(req: Request, res: Response) {
  // Authentication must remain available even if MongoDB is temporarily
  // unreachable: signIn has a safe owner/bootstrap fallback and handles the
  // database lookup failure itself. Do not turn a database outage into a
  // misleading "Authentication service unavailable" response here.
  if (!mongoReady) {
    mongoReady = connectMongo().catch(error => {
      console.error('FreshCart auth MongoDB bootstrap failed; continuing with authentication fallback:', error);
      mongoReady = null;
      return null;
    });
  }
  await mongoReady;

  const originalUrl = req.url || '/';
  const authPath = originalUrl.startsWith('/auth/')
    ? originalUrl.slice('/auth'.length)
    : originalUrl.startsWith('/api/auth/')
      ? originalUrl.slice('/api/auth'.length)
      : originalUrl.startsWith('/')
        ? originalUrl
        : `/${originalUrl}`;
  req.url = authPath || '/';
  res.setHeader('Cache-Control', 'no-store');
  return auth(req, res, (() => res.status(404).json({ error: 'Authentication route not found' })) as NextFunction);
}
