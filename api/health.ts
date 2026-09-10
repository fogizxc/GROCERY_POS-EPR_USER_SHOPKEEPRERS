import type { Request, Response } from 'express';

export default function handler(_req: Request, res: Response) {
  res.status(200).json({
    ok: true,
    service: 'freshcart-api',
    timestamp: new Date().toISOString(),
  });
}
