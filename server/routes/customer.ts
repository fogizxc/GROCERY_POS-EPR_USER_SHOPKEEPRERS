import { Router } from 'express';
import { orders, products, shops } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { findOrders, listProducts, listShops } from '../db/repositories';

export const customer = Router();
customer.use(requireAuth, requireRole('customer'));

customer.get('/home', async (_req, res) => {
  if (mongoDb()) { const [shopList, productList] = await Promise.all([listShops(), listProducts()]); return res.json({ shops: shopList, categories: [...new Set(productList.map(product => product.category))], featuredProducts: productList.slice(0, 12) }); }
  return res.json({ shops: shops.filter(shop => shop.active), categories: [...new Set(products.filter(product => product.active).map(product => product.category))], featuredProducts: products.filter(product => product.active).slice(0, 12) });
});

customer.get('/orders', async (req, res) => { if (mongoDb()) return res.json(await findOrders({ customerId: req.user!.id })); return res.json(orders.filter(order => order.customerId === req.user?.id)); });

customer.get('/orders/:id', async (req, res) => {
  const order = mongoDb() ? await mongoDb()!.collection<import('../models/domain').Order>('orders').findOne({ id: req.params.id, customerId: req.user!.id }) : orders.find(item => item.id === req.params.id && item.customerId === req.user?.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const statuses = ['PLACED', 'ACCEPTED', 'PICKING', 'PACKING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;
  const current = statuses.indexOf(order.status as typeof statuses[number]);
  return res.json({ ...order, timeline: statuses.map((status, index) => ({ status, label: status.replaceAll('_', ' '), completed: index <= current, current: index === current })) });
});

customer.post('/orders/:id/reorder', async (req, res) => {
  const previous = mongoDb() ? await mongoDb()!.collection<import('../models/domain').Order>('orders').findOne({ id: req.params.id, customerId: req.user!.id }) : orders.find(item => item.id === req.params.id && item.customerId === req.user?.id);
  if (!previous) return res.status(404).json({ error: 'Order not found' });
  if (mongoDb()) { const currentProducts = await listProducts(previous.shopId); const available = previous.items.map(item => { const product = currentProducts.find(p => p.id === item.productId && p.active); return product && product.stock >= item.quantity ? { productId: item.productId, quantity: item.quantity } : null; }); const unavailable = previous.items.filter((_item, index) => !available[index]); return res.json({ shopId: previous.shopId, items: available.filter((item): item is { productId: string; quantity: number } => Boolean(item)), unavailable: unavailable.map(item => item.name) }); }
  const available = previous.items.map(item => { const product = products.find(p => p.id === item.productId && p.active && p.shopId === previous.shopId); return product && product.stock >= item.quantity ? { productId: item.productId, quantity: item.quantity } : null; }); const unavailable = previous.items.filter((_item, index) => !available[index]); return res.json({ shopId: previous.shopId, items: available.filter((item): item is { productId: string; quantity: number } => Boolean(item)), unavailable: unavailable.map(item => item.name) });
});
