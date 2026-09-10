import { Router } from 'express';
import { orders, users } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { findOrders, listDeliveryAssignments, listStaff, updateOrderStatus, upsertDeliveryAssignment } from '../db/repositories';
import type { DeliveryAssignment } from '../models/catalog';

export const delivery = Router();
delivery.use(requireAuth, requireRole('employee', 'shopkeeper', 'store_manager', 'admin', 'super_admin'));
const deliveryStatuses = ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'] as const;

delivery.get('/queue', async (req, res) => {
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);
  if (mongoDb()) {
    const db = mongoDb()!;
    const orderFilter = isAdmin ? { status: { $in: ['READY', 'OUT_FOR_DELIVERY'] } } : { shopId: req.user!.shopId, status: { $in: ['READY', 'OUT_FOR_DELIVERY'] } };
    const queued = await findOrders(orderFilter);
    const assignments = await listDeliveryAssignments(isAdmin ? {} : { shopId: req.user!.shopId });
    const byOrder = new Map(assignments.map(assignment => [assignment.orderId, assignment]));
    const result = queued.filter(order => {
      const assignment = byOrder.get(order.id);
      return isAdmin || (assignment?.employeeId === req.user!.id) || (!assignment && order.status === 'READY' && req.user!.role !== 'employee');
    }).map(order => {
      const assignment = byOrder.get(order.id);
      return { ...order, deliveryStatus: assignment?.status, deliveryEmployeeId: assignment?.employeeId };
    });
    return res.json(result);
  }
  const assigned = orders.filter(order => (!req.user!.shopId || order.shopId === req.user!.shopId) && ['READY', 'OUT_FOR_DELIVERY'].includes(order.status));
  return res.json(assigned.map(order => ({ ...order, deliveryStatus: order.status === 'READY' ? 'ASSIGNED' : 'OUT_FOR_DELIVERY' })));
});

delivery.get('/employees', async (req, res) => { const isAdmin = ['admin', 'super_admin'].includes(req.user!.role); if (mongoDb()) return res.json(await listStaff(isAdmin ? undefined : req.user!.shopId)); return res.json(users.filter(user => user.active && ['employee', 'shopkeeper', 'store_manager'].includes(user.role) && (isAdmin || user.shopId === req.user!.shopId)).map(({ id, name, phone, role, shopId }) => ({ id, name, phone, role, shopId }))); });

delivery.get('/assignments', async (req, res) => { const isAdmin = ['admin', 'super_admin'].includes(req.user!.role); if (mongoDb()) return res.json(await listDeliveryAssignments(isAdmin ? {} : { shopId: req.user!.shopId })); return res.json([]); });

delivery.post('/orders/:id/assign', async (req, res) => {
  const employeeId = typeof req.body?.employeeId === 'string' ? req.body.employeeId : '';
  if (mongoDb()) { const db = mongoDb()!; const order = await db.collection<import('../models/domain').Order>('orders').findOne({ id: req.params.id }); if (!order) return res.status(404).json({ error: 'Order not found' }); const isAdmin = ['admin', 'super_admin'].includes(req.user!.role); if (!isAdmin && order.shopId !== req.user!.shopId) return res.status(403).json({ error: 'Order belongs to another shop' }); if (order.status !== 'READY') return res.status(400).json({ error: 'Only READY orders can be assigned' }); const employee = await db.collection<import('../models/domain').User>('users').findOne({ id: employeeId, active: true, role: { $in: ['employee', 'shopkeeper', 'store_manager'] }, shopId: order.shopId }); if (!employee) return res.status(400).json({ error: 'Valid delivery employee is required' }); const existing = await db.collection<DeliveryAssignment>('deliveryAssignments').findOne({ orderId: order.id }); if (existing && existing.status !== 'FAILED') return res.status(409).json({ error: 'Order already has an active delivery assignment' }); const assignment: DeliveryAssignment = { id: existing?.id ?? `del-${Date.now()}`, orderId: order.id, shopId: order.shopId, employeeId, status: 'ASSIGNED', assignedAt: new Date().toISOString() }; await upsertDeliveryAssignment(assignment); return res.json({ order, assignment }); }
  const order = orders.find(item => item.id === req.params.id); if (!order) return res.status(404).json({ error: 'Order not found' }); const isAdmin = ['admin', 'super_admin'].includes(req.user!.role); if (!isAdmin && order.shopId !== req.user!.shopId) return res.status(403).json({ error: 'Order belongs to another shop' }); if (order.status !== 'READY') return res.status(400).json({ error: 'Only READY orders can be assigned' }); const employee = users.find(user => user.id === employeeId && user.active && ['employee', 'shopkeeper', 'store_manager'].includes(user.role) && user.shopId === order.shopId); if (!employee) return res.status(400).json({ error: 'Valid delivery employee is required' }); return res.json({ order, assignment: { orderId: order.id, employeeId, shopId: order.shopId, status: 'ASSIGNED', assignedAt: new Date().toISOString() } });
});

delivery.patch('/orders/:id/status', async (req, res) => {
  const status = req.body?.status as typeof deliveryStatuses[number]; if (!deliveryStatuses.includes(status)) return res.status(400).json({ error: 'Invalid delivery status' });
  if (mongoDb()) {
    const db = mongoDb()!; const order = await db.collection<import('../models/domain').Order>('orders').findOne({ id: req.params.id }); if (!order) return res.status(404).json({ error: 'Order not found' }); const isAdmin = ['admin', 'super_admin'].includes(req.user!.role); if (!isAdmin && order.shopId !== req.user!.shopId) return res.status(403).json({ error: 'Insufficient permissions' }); const assignment = await db.collection<DeliveryAssignment>('deliveryAssignments').findOne({ orderId: order.id }); if (!assignment) return res.status(409).json({ error: 'Order has no delivery assignment' }); if (!isAdmin && assignment.employeeId !== req.user!.id) return res.status(403).json({ error: 'Delivery is assigned to another employee' });
    const validTransition = (from: DeliveryAssignment['status'], to: typeof deliveryStatuses[number]) => ({ ASSIGNED: ['PICKED_UP', 'FAILED'], PICKED_UP: ['OUT_FOR_DELIVERY', 'FAILED'], OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'], DELIVERED: [], FAILED: [] } as Record<DeliveryAssignment['status'], string[]>)[from].includes(to);
    if (!validTransition(assignment.status, status)) return res.status(409).json({ error: `Invalid delivery transition from ${assignment.status} to ${status}` });
    const orderStatus = status === 'PICKED_UP' || status === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : status === 'DELIVERED' ? 'DELIVERED' : status === 'FAILED' ? 'CANCELLED' : order.status;
    const updated = await updateOrderStatus(order.id, orderStatus); await upsertDeliveryAssignment({ ...assignment, status, ...(status === 'DELIVERED' ? { deliveredAt: new Date().toISOString() } : {}) }); return res.json({ ...updated, deliveryStatus: status, deliveryEmployeeId: assignment.employeeId });
  }
  const order = orders.find(item => item.id === req.params.id); if (!order) return res.status(404).json({ error: 'Order not found' }); if (status === 'DELIVERED') order.status = 'DELIVERED'; if (status === 'FAILED') order.status = 'CANCELLED'; if (status === 'PICKED_UP' || status === 'OUT_FOR_DELIVERY') order.status = 'OUT_FOR_DELIVERY'; return res.json(order);
});
