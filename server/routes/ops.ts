import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { createNotification, listNotifications, listAttendance, upsertAttendance } from '../db/repositories';
import type { Attendance, Notification } from '../models/catalog';

export const ops = Router();
ops.use(requireAuth);

ops.get('/notifications', async (req, res) => {
  if (mongoDb()) return res.json(await listNotifications(req.user!.id));
  return res.json([]);
});

ops.post('/notifications', requireRole('admin', 'super_admin'), async (req, res) => {
  const { userId, title, message, type = 'SYSTEM' } = req.body ?? {};
  if (typeof userId !== 'string' || !title || !message) return res.status(400).json({ error: 'userId, title and message are required' });
  const notification: Notification = { id: `notif-${Date.now()}`, userId, title: String(title), message: String(message), type, read: false, createdAt: new Date().toISOString() };
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
  const attendance: Attendance = { id: `att-${req.user!.id}-${now.toISOString().slice(0, 10)}`, userId: req.user!.id, shopId: req.user!.shopId, date: now.toISOString().slice(0, 10), checkIn: now.toISOString(), status: 'PRESENT' };
  if (mongoDb()) await upsertAttendance(attendance);
  return res.status(201).json(attendance);
});

ops.post('/attendance/check-out', requireRole('employee', 'shopkeeper', 'store_manager'), async (req, res) => {
  const now = new Date(); const date = now.toISOString().slice(0, 10);
  if (mongoDb()) { const existing = await mongoDb()!.collection<Attendance>('attendance').findOne({ userId: req.user!.id, date }); if (!existing) return res.status(400).json({ error: 'Check in before checking out' }); existing.checkOut = now.toISOString(); await upsertAttendance(existing); return res.json(existing); }
  return res.status(400).json({ error: 'Check in before checking out' });
});
