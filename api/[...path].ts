import type { Request, Response } from 'express';
import { app } from '../server/index.ts';
import { connectMongo } from '../server/db/mongodb.ts';

let mongoReady: Promise<unknown> | null = null;

export default async function handler(req: Request, res: Response) {
  // MongoDB is initialized opportunistically. The Express routes themselves
  // have safe fallbacks for endpoints that can operate without the database;
  // the Vercel adapter must never turn the entire API into a 503 just because
  // MongoDB is temporarily unavailable.
  if (!mongoReady) {
    mongoReady = connectMongo().catch(error => {
      console.error('FreshCart MongoDB bootstrap failed:', error);
      mongoReady = null;
      return null;
    });
  }
  await mongoReady;

  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
  }

  res.setHeader('Cache-Control', 'no-store');
  return app(req, res);
}
