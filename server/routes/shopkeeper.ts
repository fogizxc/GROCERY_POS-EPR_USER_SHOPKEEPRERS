import { Router } from 'express';
import { products, orders } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import type { OrderStatus } from '../models/domain';

export const shopkeeper = Router();
shopkeeper.use(requireAuth, requireRole('shopkeeper', 'employee', 'store_manager'));

shopkeeper.get('/orders', (req, res) => res.json(orders.filter(o => o.shopId === req.user?.shopId)));
shopkeeper.get('/stock-alerts', (req, res) => res.json(products.filter(p => p.shopId === req.user?.shopId && p.stock <= p.minStock)));

shopkeeper.patch('/orders/:id/status', (req, res) => {
  const order = orders.find(o => o.id === req.params.id && o.shopId === req.user?.shopId);
  const status = req.body?.status as OrderStatus;
  const allowed: OrderStatus[] = ['ACCEPTED', 'PICKING', 'PACKING', 'READY', 'CANCELLED'];
  if (!order) return res.status(404).json({ error: 'Order not found in assigned shop' });
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid shop order status' });
  order.status = status;
  return res.json(order);
});

shopkeeper.patch('/products/:id/stock', (req, res) => {
  const product = products.find(p => p.id === req.params.id && p.shopId === req.user?.shopId);
  const stock = Number(req.body?.stock);
  if (!product) return res.status(404).json({ error: 'Product not found in assigned shop' });
  if (!Number.isFinite(stock) || stock < 0) return res.status(400).json({ error: 'Invalid stock' });
  product.stock = stock;
  res.json(product);
});
