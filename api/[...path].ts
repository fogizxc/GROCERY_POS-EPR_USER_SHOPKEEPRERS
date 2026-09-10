import type { Request, Response } from 'express';
import { app } from '../server/index';
import { connectMongo } from '../server/db/mongodb';

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

    // Vercel may invoke a catch-all function with the function prefix removed.
    // Express routes in FreshCart are mounted under /api, so normalize the URL
    // before handing the request to the Express application.
    if (!req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
    }

    res.setHeader('Cache-Control', 'no-store');
    return app(req, res);
  } catch (error) {
    console.error('FreshCart API bootstrap failed:', error);
    return res.status(503).json({
      error: 'API unavailable',
      message: error instanceof Error ? error.message : 'Unable to initialize FreshCart API',
    });
  }
}
