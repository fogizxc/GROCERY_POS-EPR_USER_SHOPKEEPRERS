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
    const adminPath = originalUrl.startsWith('/api/admin/')
      ? originalUrl.slice('/api'.length)
      : originalUrl.startsWith('/admin/')
        ? originalUrl
        : originalUrl.startsWith('/')
          ? `/admin${originalUrl}`
          : `/admin/${originalUrl}`;

    req.url = adminPath || '/admin';
    res.setHeader('Cache-Control', 'no-store');
    return admin(req, res, (() => res.status(404).json({ error: 'Admin route not found' })) as NextFunction);
  } catch (error) {
    console.error('FreshCart admin handler failed:', error);
    return res.status(500).json({ error: 'Admin request failed' });
  }
}
