import { Router } from 'express';
import { products, orders } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import type { OrderStatus } from '../models/domain';
import { mongoDb } from '../db/mongodb';
import { findOrders, listProducts, updateOrderStatus, updateStock } from '../db/repositories';

export const shopkeeper = Router();
shopkeeper.use(requireAuth, requireRole('shopkeeper', 'employee', 'store_manager'));

shopkeeper.get('/orders', async (req, res) => {
  const shopId = req.user!.shopId;
  if (mongoDb()) return res.json(await findOrders({ shopId }));
  return res.json(orders.filter(o => o.shopId === shopId));
});
shopkeeper.get('/stock-alerts', async (req, res) => {
  const shopId = req.user!.shopId;
  if (mongoDb()) return res.json((await listProducts(shopId)).filter(p => p.stock <= p.minStock));
  return res.json(products.filter(p => p.shopId === shopId && p.stock <= p.minStock));
});
shopkeeper.patch('/orders/:id/status', async (req, res) => {
  const status = req.body?.status as OrderStatus;
  const allowed: OrderStatus[] = ['ACCEPTED', 'PICKING', 'PACKING', 'READY', 'CANCELLED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid shop order status' });
  if (mongoDb()) { const result = await mongoDb()!.collection<import('../models/domain').Order>('orders').findOne({ id: req.params.id, shopId: req.user!.shopId }); if (!result) return res.status(404).json({ error: 'Order not found in assigned shop' }); const updated = await updateOrderStatus(result.id, status); return res.json(updated); }
  const order = orders.find(o => o.id === req.params.id && o.shopId === req.user?.shopId); if (!order) return res.status(404).json({ error: 'Order not found in assigned shop' }); order.status = status; return res.json(order);
});
shopkeeper.patch('/products/:id/stock', async (req, res) => {
  const stock = Number(req.body?.stock); if (!Number.isFinite(stock) || stock < 0) return res.status(400).json({ error: 'Invalid stock' });
  if (mongoDb()) { const product = await mongoDb()!.collection<import('../models/domain').Product>('products').findOne({ id: req.params.id, shopId: req.user!.shopId }); if (!product) return res.status(404).json({ error: 'Product not found in assigned shop' }); const updated = await updateStock(product.id, stock); return res.json(updated); }
  const product = products.find(p => p.id === req.params.id && p.shopId === req.user?.shopId); if (!product) return res.status(404).json({ error: 'Product not found in assigned shop' }); product.stock = stock; return res.json(product);
});
