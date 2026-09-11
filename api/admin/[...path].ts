import type { Request, Response, NextFunction } from 'express';
import { admin } from '../../server/routes/admin.ts';
import { connectMongo } from '../../server/db/mongodb.ts';

let mongoReady: Promise<unknown> | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!mongoReady) {
      mongoReady = connectMongo().catch(error => {
        console.error('FreshCart admin MongoDB bootstrap failed:', error);
        mongoReady = null;
        return null;
      });
    }
    await mongoReady;

    const originalUrl = req.url || '/';
    // The Express router is mounted directly here, so it expects paths such as
    // /dashboard and /super-dashboard rather than the public /api/admin prefix.
    const adminPath = originalUrl.startsWith('/api/admin/')
      ? originalUrl.slice('/api/admin'.length)
      : originalUrl.startsWith('/admin/')
        ? originalUrl.slice('/admin'.length)
        : originalUrl.startsWith('/api/')
          ? originalUrl.slice('/api'.length)
          : originalUrl.startsWith('/')
            ? originalUrl
            : `/${originalUrl}`;

    req.url = adminPath || '/';
    res.setHeader('Cache-Control', 'no-store');
    return admin(req, res, (() => res.status(404).json({ error: 'Admin route not found' })) as NextFunction);
  } catch (error) {
    console.error('FreshCart admin handler failed:', error);
    return res.status(500).json({ error: 'Admin request failed' });
  }
}
