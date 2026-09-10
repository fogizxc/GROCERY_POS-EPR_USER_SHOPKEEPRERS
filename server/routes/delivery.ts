import { Router } from 'express';
import { orders, users } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';

export const delivery = Router();
delivery.use(requireAuth, requireRole('employee', 'shopkeeper', 'store_manager', 'admin', 'super_admin'));

const deliveryStatuses = ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'] as const;

delivery.get('/queue', (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const shopId = isAdmin ? undefined : req.user?.shopId;
  res.json(orders.filter(order => (!shopId || order.shopId === shopId) && ['READY', 'OUT_FOR_DELIVERY'].includes(order.status)));
});

delivery.get('/employees', (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  res.json(users.filter(user => user.active && ['employee', 'shopkeeper', 'store_manager'].includes(user.role) && (isAdmin || user.shopId === req.user?.shopId)).map(({ id, name, phone, role, shopId }) => ({ id, name, phone, role, shopId })));
});

delivery.post('/orders/:id/assign', (req, res) => {
  const order = orders.find(item => item.id === req.params.id);
  const employeeId = typeof req.body?.employeeId === 'string' ? req.body.employeeId : '';
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  if (!isAdmin && order.shopId !== req.user?.shopId) return res.status(403).json({ error: 'Order belongs to another shop' });
  if (order.status !== 'READY') return res.status(400).json({ error: 'Only READY orders can be assigned' });
  const employee = users.find(user => user.id === employeeId && user.active && ['employee', 'shopkeeper', 'store_manager'].includes(user.role) && (isAdmin || user.shopId === order.shopId));
  if (!employee) return res.status(400).json({ error: 'Valid delivery employee is required' });
  order.status = 'OUT_FOR_DELIVERY';
  return res.json({ order, assignment: { orderId: order.id, employeeId: employee.id, shopId: order.shopId, status: 'OUT_FOR_DELIVERY', assignedAt: new Date().toISOString() } });
});

delivery.patch('/orders/:id/status', (req, res) => {
  const order = orders.find(item => item.id === req.params.id);
  const status = req.body?.status as (typeof deliveryStatuses)[number];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!deliveryStatuses.includes(status)) return res.status(400).json({ error: 'Invalid delivery status' });
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  if (!isAdmin && req.user?.shopId !== order.shopId) return res.status(403).json({ error: 'Insufficient permissions' });
  if (status === 'ASSIGNED' && order.status !== 'READY') return res.status(400).json({ error: 'Order must be READY before assignment' });
  if (status === 'PICKED_UP' && order.status !== 'OUT_FOR_DELIVERY') return res.status(400).json({ error: 'Order must be OUT_FOR_DELIVERY before pickup' });
  if (status === 'OUT_FOR_DELIVERY' && !['OUT_FOR_DELIVERY', 'PICKED_UP'].includes(order.status)) return res.status(400).json({ error: 'Order is not ready for delivery' });
  if (status === 'DELIVERED') order.status = 'DELIVERED';
  if (status === 'FAILED') order.status = 'CANCELLED';
  return res.json(order);
});
