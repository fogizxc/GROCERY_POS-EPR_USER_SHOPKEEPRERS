import type { Request, Response } from 'express';
import { app } from '../server/index';
import { connectMongo } from '../server/db/mongodb';

let mongoReady: Promise<unknown> | null = null;

export default async function handler(req: Request, res: Response) {
  if (!mongoReady) mongoReady = connectMongo();
  await mongoReady;
  return app(req, res);
}
