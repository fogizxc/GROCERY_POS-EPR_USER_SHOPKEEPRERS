import { Router } from 'express';
import { addresses, deliverySlots, orders, payments, products, shops } from '../store/memoryStore';
import type { Address, Payment } from '../models/catalog';
import type { OrderStatus } from '../models/domain';
import { requireAuth } from '../auth/middleware';

export const api = Router();

api.get('/health', (_req, res) => res.json({ ok: true, service: 'freshcart-api', timestamp: new Date().toISOString() }));
api.get('/products', (req, res) => {
  const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  res.json(products.filter(p => p.active && (!shopId || p.shopId === shopId) && (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q))));
});
api.get('/shops', (_req, res) => res.json(shops.filter(s => s.active)));

api.get('/users/:id', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin' && req.user?.id !== req.params.id) return res.status(403).json({ error: 'Insufficient permissions' });
  const user = require('../store/memoryStore').users.find((u: { id: string }) => u.id === req.params.id);
  return user ? res.json(user) : res.status(404).json({ error: 'User not found' });
});

api.get('/addresses', requireAuth, (req, res) => res.json(addresses.filter(address => address.userId === req.user?.id)));
api.post('/addresses', requireAuth, (req, res) => {
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Only customers can manage addresses' });
  const { label = 'HOME', line1, line2, city, state, postalCode, landmark, isDefault = false } = req.body ?? {};
  if (!line1 || !city || !state || !postalCode) return res.status(400).json({ error: 'line1, city, state and postalCode are required' });
  const userAddresses = addresses.filter(address => address.userId === req.user!.id);
  if (isDefault) userAddresses.forEach(address => { address.isDefault = false; });
  const address: Address = { id: `addr-${Date.now()}`, userId: req.user.id, label, line1, line2, city, state, postalCode, landmark, isDefault: Boolean(isDefault) || userAddresses.length === 0 };
  addresses.push(address);
  return res.status(201).json(address);
});

api.get('/delivery-slots', requireAuth, (req, res) => {
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Only customers can view delivery slots' });
  res.json(deliverySlots.filter(slot => slot.active && slot.booked < slot.capacity));
});

api.get('/orders', requireAuth, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status as OrderStatus : undefined;
  const requestedShopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const shopId = isAdmin ? requestedShopId : req.user?.shopId;
  const customerId = req.user?.role === 'customer' ? req.user.id : undefined;
  res.json(orders.filter(o => (!status || o.status === status) && (!shopId || o.shopId === shopId) && (!customerId || o.customerId === customerId)));
});

api.post('/orders', requireAuth, (req, res) => {
  const { shopId, items, paymentMethod = 'COD', addressId, deliverySlotId } = req.body ?? {};
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Only customers can place orders' });
  if (!shopId || !Array.isArray(items) || items.length === 0 || typeof addressId !== 'string' || typeof deliverySlotId !== 'string') return res.status(400).json({ error: 'shopId, items, addressId and deliverySlotId are required' });
  if (!['UPI', 'CARD', 'COD'].includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method' });
  const address = addresses.find(item => item.id === addressId && item.userId === req.user!.id);
  const slot = deliverySlots.find(item => item.id === deliverySlotId && item.active);
  if (!address) return res.status(400).json({ error: 'Valid delivery address is required' });
  if (!slot || slot.booked >= slot.capacity) return res.status(400).json({ error: 'Delivery slot is unavailable' });

  const normalizedItems = items.map((i: unknown) => {
    const item = i as { productId?: unknown; quantity?: unknown };
    const productId = typeof item.productId === 'string' ? item.productId : '';
    const quantity = Number(item.quantity);
    const product = products.find(p => p.id === productId && p.active && p.shopId === shopId);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || product.stock < quantity) return null;
    return { product, quantity };
  });
  if (normalizedItems.some(item => item === null)) return res.status(400).json({ error: 'One or more products are unavailable or have insufficient stock' });

  const orderItems = normalizedItems.map(item => ({ productId: item!.product.id, name: item!.product.name, quantity: item!.quantity, unitPrice: item!.product.sellingPrice }));
  const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const deliveryFee = subtotal >= 499 ? 0 : 39;
  const order = { id: `FC-${Date.now()}-${orders.length}`, customerId: req.user.id, shopId, items: orderItems, subtotal, deliveryFee, total: subtotal + deliveryFee, paymentMethod: paymentMethod as 'UPI' | 'CARD' | 'COD', status: 'PLACED' as const, createdAt: new Date().toISOString() };
  orderItems.forEach(item => { const product = products.find(p => p.id === item.productId); if (product) product.stock -= item.quantity; });
  slot.booked += 1;
  orders.unshift(order);
  const payment: Payment = { id: `pay-${Date.now()}`, orderId: order.id, method: order.paymentMethod, status: 'PENDING', amount: order.total, provider: order.paymentMethod === 'COD' ? undefined : 'pending', createdAt: new Date().toISOString() };
  payments.push(payment);
  return res.status(201).json({ ...order, address, deliverySlot: slot, payment });
});

api.patch('/orders/:id/status', requireAuth, (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  const status = req.body?.status as OrderStatus;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const canManage = isAdmin || (['shopkeeper', 'employee', 'store_manager'].includes(req.user?.role ?? '') && req.user?.shopId === order.shopId);
  if (!canManage && !(req.user?.role === 'customer' && req.user.id === order.customerId && status === 'CANCELLED')) return res.status(403).json({ error: 'Insufficient permissions' });
  const allowed: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PICKING', 'PACKING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  order.status = status;
  return res.json(order);
});

api.patch('/products/:id/stock', requireAuth, (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  const stock = Number(req.body?.stock);
  const canManage = (req.user?.role === 'admin' || req.user?.role === 'super_admin') || (['shopkeeper', 'employee', 'store_manager'].includes(req.user?.role ?? '') && product?.shopId === req.user?.shopId);
  if (!canManage) return res.status(403).json({ error: 'Insufficient permissions' });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!Number.isFinite(stock) || stock < 0) return res.status(400).json({ error: 'Stock must be a non-negative number' });
  product.stock = stock;
  return res.json(product);
});
