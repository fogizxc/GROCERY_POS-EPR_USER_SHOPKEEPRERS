import type { Request, Response, NextFunction } from 'express';
import { connectMongo } from '../../server/db/mongodb.ts';
import { auth } from '../../server/routes/auth.ts';

let mongoReady: Promise<unknown> | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!mongoReady) {
      mongoReady = connectMongo().catch(error => {
        mongoReady = null;
        throw error;
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
  } catch (error) {
    console.error('FreshCart auth bootstrap failed:', error);
    return res.status(503).json({
      error: 'Authentication service unavailable',
      message: error instanceof Error ? error.message : 'Unable to initialize authentication service',
    });
  }
}
