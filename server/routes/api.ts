import { Router } from 'express';
import { orders, products, shops, users } from '../store/memoryStore';
import type { OrderStatus } from '../models/domain';

export const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true, service: 'freshcart-api', timestamp: new Date().toISOString() }));
api.get('/products', (req, res) => {
  const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : '';
  res.json(products.filter(p => p.active && (!shopId || p.shopId === shopId) && (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q))));
});
api.get('/shops', (_req, res) => res.json(shops.filter(s => s.active)));
api.get('/users/:id', (req, res) => { const user = users.find(u => u.id === req.params.id); return user ? res.json(user) : res.status(404).json({ error: 'User not found' }); });
api.get('/orders', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status as OrderStatus : undefined;
  const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
  res.json(orders.filter(o => (!status || o.status === status) && (!shopId || o.shopId === shopId)));
});
api.post('/orders', (req, res) => {
  const { customerId, shopId, items, paymentMethod = 'COD' } = req.body ?? {};
  if (!customerId || !shopId || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'customerId, shopId and items are required' });
  const orderItems = items.map((i: { productId: string; quantity: number }) => {
    const product = products.find(p => p.id === i.productId && p.active && p.shopId === shopId);
    if (!product || !Number.isFinite(i.quantity) || i.quantity < 1 || product.stock < i.quantity) throw new Error(`Unavailable product: ${i.productId}`);
    return { productId: product.id, name: product.name, quantity: i.quantity, unitPrice: product.sellingPrice };
  });
  const subtotal = orderItems.reduce((sum: number, i: { quantity: number; unitPrice: number }) => sum + i.quantity * i.unitPrice, 0);
  const order = { id: `FC-${String(1049 + orders.length)}`, customerId, shopId, items: orderItems, subtotal, deliveryFee: subtotal >= 499 ? 0 : 39, total: subtotal + (subtotal >= 499 ? 0 : 39), paymentMethod, status: 'PLACED' as const, createdAt: new Date().toISOString() };
  order.items.forEach(i => { const p = products.find(x => x.id === i.productId); if (p) p.stock -= i.quantity; });
  orders.unshift(order);
  res.status(201).json(order);
});
api.patch('/orders/:id/status', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  const status = req.body?.status as OrderStatus;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const allowed: OrderStatus[] = ['PLACED','ACCEPTED','PICKING','PACKING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  order.status = status;
  res.json(order);
});
api.patch('/products/:id/stock', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  const stock = Number(req.body?.stock);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!Number.isFinite(stock) || stock < 0) return res.status(400).json({ error: 'Stock must be a non-negative number' });
  product.stock = stock;
  res.json(product);
});
