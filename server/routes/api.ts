import { Router } from 'express';
import { addresses, deliverySlots, orders, payments, products, shops } from '../store/memoryStore';
import type { Address, Payment } from '../models/catalog';
import type { OrderStatus } from '../models/domain';
import { requireAuth } from '../auth/middleware';
import { listProducts, listShops, listAddresses, insertAddress, listDeliverySlots, reserveProductsAndSlot, insertOrder, insertPayment, findOrders, updateOrderStatus } from '../db/repositories';
import { mongoDb } from '../db/mongodb';

export const api = Router();
api.get('/health', (_req, res) => res.json({ ok: true, service: 'freshcart-api', timestamp: new Date().toISOString() }));

api.get('/products', async (req, res) => {
  const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const persistent = await listProducts(shopId, category, q);
  if (mongoDb()) return res.json(persistent);
  return res.json(products.filter(p => p.active && (!shopId || p.shopId === shopId) && (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q))));
});

api.get('/shops', async (_req, res) => {
  const persistent = await listShops();
  if (mongoDb()) return res.json(persistent);
  return res.json(shops.filter(s => s.active));
});

api.get('/users/:id', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin' && req.user?.id !== req.params.id) return res.status(403).json({ error: 'Insufficient permissions' });
  const user = require('../store/memoryStore').users.find((u: { id: string }) => u.id === req.params.id);
  return user ? res.json(user) : res.status(404).json({ error: 'User not found' });
});

api.get('/addresses', requireAuth, async (req, res) => {
  const persistent = await listAddresses(req.user!.id);
  if (mongoDb()) return res.json(persistent);
  return res.json(addresses.filter(address => address.userId === req.user?.id));
});

api.post('/addresses', requireAuth, async (req, res) => {
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Only customers can manage addresses' });
  const { label = 'HOME', line1, line2, city, state, postalCode, landmark, isDefault = false } = req.body ?? {};
  if (!line1 || !city || !state || !postalCode) return res.status(400).json({ error: 'line1, city, state and postalCode are required' });
  const address: Address = { id: `addr-${Date.now()}`, userId: req.user.id, label, line1, line2, city, state, postalCode, landmark, isDefault: Boolean(isDefault) };
  if (mongoDb()) { if (!(await listAddresses(req.user.id)).length) address.isDefault = true; await insertAddress(address); return res.status(201).json(address); }
  const userAddresses = addresses.filter(item => item.userId === req.user!.id);
  if (address.isDefault) userAddresses.forEach(item => { item.isDefault = false; });
  address.isDefault = address.isDefault || userAddresses.length === 0;
  addresses.push(address);
  return res.status(201).json(address);
});

api.get('/delivery-slots', requireAuth, async (req, res) => {
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Only customers can view delivery slots' });
  const persistent = await listDeliverySlots();
  if (mongoDb()) return res.json(persistent);
  return res.json(deliverySlots.filter(slot => slot.active && slot.booked < slot.capacity));
});

api.get('/orders', requireAuth, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status as OrderStatus : undefined;
  const requestedShopId = typeof req.query.shopId === 'string' ? req.query.shopId : undefined;
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const shopId = isAdmin ? requestedShopId : req.user?.shopId;
  const customerId = req.user?.role === 'customer' ? req.user.id : undefined;
  const filter = { ...(status ? { status } : {}), ...(shopId ? { shopId } : {}), ...(customerId ? { customerId } : {}) };
  if (mongoDb()) return res.json(await findOrders(filter));
  return res.json(orders.filter(o => (!status || o.status === status) && (!shopId || o.shopId === shopId) && (!customerId || o.customerId === customerId)));
});

api.post('/orders', requireAuth, async (req, res) => {
  const { shopId, items, paymentMethod = 'COD', addressId, deliverySlotId } = req.body ?? {};
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Only customers can place orders' });
  if (!shopId || !Array.isArray(items) || !items.length || typeof addressId !== 'string' || typeof deliverySlotId !== 'string') return res.status(400).json({ error: 'shopId, items, addressId and deliverySlotId are required' });
  if (!['UPI', 'CARD', 'COD'].includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method' });
  if (mongoDb()) {
    const address = await mongoDb()!.collection<Address>('addresses').findOne({ id: addressId, userId: req.user.id });
    if (!address) return res.status(400).json({ error: 'Valid delivery address is required' });
    const reserved = await reserveProductsAndSlot(shopId, items.map((item: { productId: string; quantity: number }) => ({ productId: item.productId, quantity: Number(item.quantity) })), deliverySlotId);
    if (!reserved.slot || reserved.products.length !== items.length) return res.status(400).json({ error: 'Products or delivery slot became unavailable' });
    const orderItems = reserved.products.map((product, index) => ({ productId: product.id, name: product.name, quantity: Number(items[index].quantity), unitPrice: product.sellingPrice }));
    const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const deliveryFee = subtotal >= 499 ? 0 : 39;
    const order = { id: `FC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, customerId: req.user.id, shopId, items: orderItems, subtotal, deliveryFee, total: subtotal + deliveryFee, paymentMethod: paymentMethod as 'UPI' | 'CARD' | 'COD', status: 'PLACED' as const, createdAt: new Date().toISOString() };
    const payment: Payment = { id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, orderId: order.id, method: order.paymentMethod, status: 'PENDING', amount: order.total, provider: order.paymentMethod === 'COD' ? undefined : 'pending', createdAt: new Date().toISOString() };
    await insertOrder(order); await insertPayment(payment);
    return res.status(201).json({ ...order, address, deliverySlot: reserved.slot, payment });
  }
  const address = addresses.find(item => item.id === addressId && item.userId === req.user!.id);
  const slot = deliverySlots.find(item => item.id === deliverySlotId && item.active);
  if (!address) return res.status(400).json({ error: 'Valid delivery address is required' });
  if (!slot || slot.booked >= slot.capacity) return res.status(400).json({ error: 'Delivery slot is unavailable' });
  const normalizedItems = items.map((i: unknown) => { const item = i as { productId?: unknown; quantity?: unknown }; const productId = typeof item.productId === 'string' ? item.productId : ''; const quantity = Number(item.quantity); const product = products.find(p => p.id === productId && p.active && p.shopId === shopId); if (!product || !Number.isInteger(quantity) || quantity < 1 || product.stock < quantity) return null; return { product, quantity }; });
  if (normalizedItems.some(item => item === null)) return res.status(400).json({ error: 'One or more products are unavailable or have insufficient stock' });
  const orderItems = normalizedItems.map(item => ({ productId: item!.product.id, name: item!.product.name, quantity: item!.quantity, unitPrice: item!.product.sellingPrice }));
  const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0); const deliveryFee = subtotal >= 499 ? 0 : 39;
  const order = { id: `FC-${Date.now()}-${orders.length}`, customerId: req.user.id, shopId, items: orderItems, subtotal, deliveryFee, total: subtotal + deliveryFee, paymentMethod: paymentMethod as 'UPI' | 'CARD' | 'COD', status: 'PLACED' as const, createdAt: new Date().toISOString() };
  orderItems.forEach(item => { const product = products.find(p => p.id === item.productId); if (product) product.stock -= item.quantity; }); slot.booked += 1; orders.unshift(order);
  const payment: Payment = { id: `pay-${Date.now()}`, orderId: order.id, method: order.paymentMethod, status: 'PENDING', amount: order.total, provider: order.paymentMethod === 'COD' ? undefined : 'pending', createdAt: new Date().toISOString() }; payments.push(payment);
  return res.status(201).json({ ...order, address, deliverySlot: slot, payment });
});

api.patch('/orders/:id/status', requireAuth, async (req, res) => {
  const status = req.body?.status as OrderStatus;
  const allowed: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PICKING', 'PACKING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (mongoDb()) {
    const order = await mongoDb()!.collection<import('../models/domain').Order>('orders').findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin'; const canManage = isAdmin || (['shopkeeper', 'employee', 'store_manager'].includes(req.user?.role ?? '') && req.user?.shopId === order.shopId);
    if (!canManage && !(req.user?.role === 'customer' && req.user.id === order.customerId && status === 'CANCELLED')) return res.status(403).json({ error: 'Insufficient permissions' });
    const updated = await updateOrderStatus(order.id, status); return res.json(updated);
  }
  const order = orders.find(o => o.id === req.params.id); if (!order) return res.status(404).json({ error: 'Order not found' });
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin'; const canManage = isAdmin || (['shopkeeper', 'employee', 'store_manager'].includes(req.user?.role ?? '') && req.user?.shopId === order.shopId);
  if (!canManage && !(req.user?.role === 'customer' && req.user.id === order.customerId && status === 'CANCELLED')) return res.status(403).json({ error: 'Insufficient permissions' }); order.status = status; return res.json(order);
});

api.patch('/products/:id/stock', requireAuth, async (req, res) => {
  const stock = Number(req.body?.stock); if (!Number.isFinite(stock) || stock < 0) return res.status(400).json({ error: 'Stock must be a non-negative number' });
  if (mongoDb()) {
    const product = await mongoDb()!.collection<import('../models/domain').Product>('products').findOne({ id: req.params.id }); if (!product) return res.status(404).json({ error: 'Product not found' });
    const canManage = (req.user?.role === 'admin' || req.user?.role === 'super_admin') || (['shopkeeper', 'employee', 'store_manager'].includes(req.user?.role ?? '') && product.shopId === req.user?.shopId); if (!canManage) return res.status(403).json({ error: 'Insufficient permissions' });
    const updated = await mongoDb()!.collection<import('../models/domain').Product>('products').findOneAndUpdate({ id: product.id }, { $set: { stock } }, { returnDocument: 'after' }); return res.json(updated);
  }
  const product = products.find(p => p.id === req.params.id); if (!product) return res.status(404).json({ error: 'Product not found' }); const canManage = (req.user?.role === 'admin' || req.user?.role === 'super_admin') || (['shopkeeper', 'employee', 'store_manager'].includes(req.user?.role ?? '') && product.shopId === req.user?.shopId); if (!canManage) return res.status(403).json({ error: 'Insufficient permissions' }); product.stock = stock; return res.json(product);
});
