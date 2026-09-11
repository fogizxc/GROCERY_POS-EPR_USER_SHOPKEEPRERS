import { Router } from 'express';
import { mongoDb } from '../db/mongodb.ts';
import { requireAuth, requireRole } from '../auth/middleware.ts';
import type { Order } from '../models/domain.ts';

export const rewards = Router();
rewards.get('/', requireAuth, requireRole('customer'), async (req, res) => {
  const db = mongoDb();
  if (!db) return res.status(503).json({ error: 'MongoDB is required for rewards' });
  const completed = await db.collection<Order>('orders').find({ customerId: req.user!.id, status: { $in: ['DELIVERED', 'COLLECTED'] } }).project({ total: 1 }).toArray();
  const spent = completed.reduce((sum, order) => sum + Number(order.total || 0), 0);
  return res.json({ points: Math.floor(spent), spent, orders: completed.length, rate: 1 });
});
