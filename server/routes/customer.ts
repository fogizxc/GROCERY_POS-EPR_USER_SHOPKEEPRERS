import { Router } from 'express';
import { orders, products, shops } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';

export const customer = Router();
customer.use(requireAuth, requireRole('customer'));

customer.get('/home', (_req, res) => {
  res.json({
    shops: shops.filter(shop => shop.active),
    categories: [...new Set(products.filter(product => product.active).map(product => product.category))],
    featuredProducts: products.filter(product => product.active).slice(0, 12),
  });
});

customer.get('/orders', (req, res) => {
  const customerOrders = orders.filter(order => order.customerId === req.user?.id);
  res.json(customerOrders);
});

customer.get('/orders/:id', (req, res) => {
  const order = orders.find(item => item.id === req.params.id && item.customerId === req.user?.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({
    ...order,
    timeline: [
      ['PLACED', 'Order placed'],
      ['ACCEPTED', 'Shop accepted order'],
      ['PICKING', 'Items are being picked'],
      ['PACKING', 'Order is being packed'],
      ['READY', 'Ready for delivery'],
      ['OUT_FOR_DELIVERY', 'Out for delivery'],
      ['DELIVERED', 'Delivered'],
    ].map(([status, label]) => ({ status, label, completed: status === order.status || ['PLACED', 'ACCEPTED', 'PICKING', 'PACKING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].indexOf(status) < ['PLACED', 'ACCEPTED', 'PICKING', 'PACKING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].indexOf(order.status) })),
  });
});

customer.post('/orders/:id/reorder', (req, res) => {
  const previous = orders.find(item => item.id === req.params.id && item.customerId === req.user?.id);
  if (!previous) return res.status(404).json({ error: 'Order not found' });
  const available = previous.items.map(item => {
    const product = products.find(p => p.id === item.productId && p.active && p.shopId === previous.shopId);
    return product && product.stock >= item.quantity ? { productId: item.productId, quantity: item.quantity } : null;
  });
  const unavailable = previous.items.filter((_item, index) => !available[index]);
  res.json({ shopId: previous.shopId, items: available.filter(Boolean), unavailable: unavailable.map(item => item.name) });
});
