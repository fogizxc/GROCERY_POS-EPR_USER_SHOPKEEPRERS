import type { Request, Response, NextFunction } from 'express';
import { admin } from '../../../server/routes/admin.ts';
import { connectMongo } from '../../../server/db/mongodb.ts';

let mongoReady: Promise<unknown> | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!mongoReady) {
      mongoReady = connectMongo().catch(error => {
        console.error('FreshCart partner MongoDB bootstrap failed:', error);
        mongoReady = null;
        return null;
      });
    }
    await mongoReady;

    req.url = '/partners/create';
    res.setHeader('Cache-Control', 'no-store');
    return admin(req, res, (() => res.status(404).json({ error: 'Partner creation route not found' })) as NextFunction);
  } catch (error) {
    console.error('FreshCart partner creation handler failed:', error);
    return res.status(500).json({ error: 'Partner creation request failed' });
  }
}
