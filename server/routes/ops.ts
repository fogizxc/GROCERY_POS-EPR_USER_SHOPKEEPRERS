import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { createNotification, listNotifications, markNotificationRead, listAttendance, upsertAttendance } from '../db/repositories';
import type { Attendance, Notification } from '../models/catalog';

export const ops = Router();
ops.use(requireAuth);

ops.get('/notifications', async (req, res) => {
  if (mongoDb()) return res.json(await listNotifications(req.user!.id));
  return res.json([]);
});

ops.patch('/notifications/:id/read', async (req, res) => {
  if (mongoDb()) {
    const notification = await markNotificationRead(req.params.id, req.user!.id);
    return notification ? res.json(notification) : res.status(404).json({ error: 'Notification not found' });
  }
  return res.status(404).json({ error: 'Notification not found' });
});

ops.post('/notifications', requireRole('admin', 'super_admin'), async (req, res) => {
  const { userId, title, message, type = 'SYSTEM' } = req.body ?? {};
  const validTypes = ['ORDER', 'STOCK', 'PAYMENT', 'SYSTEM', 'OFFER'];
  if (typeof userId !== 'string' || !userId || typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim() || !validTypes.includes(type)) {
    return res.status(400).json({ error: 'userId, title, message and a valid notification type are required' });
  }
  const notification: Notification = { id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId, title: title.trim(), message: message.trim(), type, read: false, createdAt: new Date().toISOString() };
  if (mongoDb()) await createNotification(notification);
  return res.status(201).json(notification);
});

ops.get('/attendance', requireRole('employee', 'shopkeeper', 'store_manager', 'admin', 'super_admin'), async (req, res) => {
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);
  const userId = isAdmin && typeof req.query.userId === 'string' ? req.query.userId : req.user!.id;
  if (mongoDb()) return res.json(await listAttendance(userId, typeof req.query.from === 'string' ? req.query.from : undefined, typeof req.query.to === 'string' ? req.query.to : undefined));
  return res.json([]);
});

ops.post('/attendance/check-in', requireRole('employee', 'shopkeeper', 'store_manager'), async (req, res) => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  if (mongoDb()) {
    const existing = await mongoDb()!.collection<Attendance>('attendance').findOne({ userId: req.user!.id, date });
    if (existing?.checkIn) return res.json(existing);
  }
  const attendance: Attendance = { id: `att-${req.user!.id}-${date}`, userId: req.user!.id, shopId: req.user!.shopId, date, checkIn: now.toISOString(), status: 'PRESENT' };
  if (mongoDb()) await upsertAttendance(attendance);
  return res.status(201).json(attendance);
});

ops.post('/attendance/check-out', requireRole('employee', 'shopkeeper', 'store_manager'), async (req, res) => {
  const now = new Date(); const date = now.toISOString().slice(0, 10);
  if (mongoDb()) {
    const existing = await mongoDb()!.collection<Attendance>('attendance').findOne({ userId: req.user!.id, date });
    if (!existing?.checkIn) return res.status(400).json({ error: 'Check in before checking out' });
    if (existing.checkOut) return res.json(existing);
    existing.checkOut = now.toISOString(); await upsertAttendance(existing); return res.json(existing);
  }
  return res.status(400).json({ error: 'Check in before checking out' });
});
