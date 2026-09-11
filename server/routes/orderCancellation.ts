import { Router } from 'express';
import { requireAuth } from '../auth/middleware.ts';
import { mongoDb, } from '../db/mongodb.ts';
import { cancelOrderTransaction } from '../db/repositories.ts';
import type { Order } from '../models/domain.ts';
import type { Payment } from '../models/catalog.ts';

export const orderCancellation = Router();
orderCancellation.patch('/orders/:id/status', requireAuth, async (req, res, next) => {
  if (req.body?.status !== 'CANCELLED' || !mongoDb()) return next();
  const db = mongoDb()!;
  const order = await db.collection<Order>('orders').findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const canManage = isAdmin || (['shopkeeper','employee','store_manager'].includes(req.user?.role ?? '') && req.user?.shopId === order.shopId);
  if (!canManage && !(req.user?.role === 'customer' && req.user.id === order.customerId)) return res.status(403).json({ error: 'Insufficient permissions' });
  if (order.status === 'CANCELLED') return res.json(order);
  if (!['PLACED','ACCEPTED'].includes(order.status)) return res.status(409).json({ error: 'Order can no longer be cancelled' });
  const payment = await db.collection<Payment>('payments').findOne({ orderId: order.id });
  try { return res.json(await cancelOrderTransaction(order, payment ?? undefined)); }
  catch (error) { return res.status(409).json({ error: error instanceof Error ? error.message : 'Unable to cancel order' }); }
});
