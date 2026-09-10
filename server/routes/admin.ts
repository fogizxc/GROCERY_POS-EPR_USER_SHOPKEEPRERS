import { Router } from 'express';
import { products, orders, shops, users } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { findOrders, listProducts, listShops, listStaff } from '../db/repositories';
import { adminCatalog } from './adminCatalog';
import { approveSalesImport, rejectSalesImport } from './onboarding';
import type { PartnerApplicationType } from './onboarding';
import type { SalesImport } from '../models/domain';

export const admin = Router();
admin.use(requireAuth, requireRole('admin', 'super_admin'));
admin.use('/catalog', adminCatalog);

admin.get('/dashboard', async (_req, res) => {
  if (mongoDb()) {
    const db = mongoDb()!;
    const [allOrders, allProducts, allShops, staff] = await Promise.all([findOrders(), db.collection<import('../models/domain').Product>('products').find({}).toArray(), listShops(), listStaff()]);
    const delivered = allOrders.filter(o => o.status === 'DELIVERED');
    return res.json({ revenue: delivered.reduce((sum, order) => sum + order.total, 0), activeOrders: allOrders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)).length, products: allProducts.length, lowStock: allProducts.filter(p => p.stock <= p.minStock).length, shops: allShops.length, staff: staff.length });
  }
  const activeOrders = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)); const revenue = orders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.total, 0); return res.json({ revenue, activeOrders: activeOrders.length, products: products.length, lowStock: products.filter(p => p.stock <= p.minStock).length, shops: shops.filter(s => s.active).length, staff: users.filter(u => u.active && u.role !== 'customer').length });
});

admin.get('/products', async (_req, res) => { if (mongoDb()) return res.json(await mongoDb()!.collection<import('../models/domain').Product>('products').find({}).toArray()); return res.json(products); });
admin.get('/shops', async (_req, res) => { if (mongoDb()) return res.json(await listShops()); return res.json(shops); });
admin.get('/staff', async (_req, res) => { if (mongoDb()) return res.json(await listStaff()); return res.json(users.filter(u => u.role !== 'customer')); });
admin.get('/orders', async (_req, res) => { if (mongoDb()) return res.json(await findOrders()); return res.json(orders); });

admin.get('/onboarding/applications', async (req, res) => {
  const db = mongoDb();
  if (!db) return res.status(503).json({ error: 'MongoDB is required for onboarding approvals' });
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING_REVIEW';
  const applications = await db.collection('onboardingApplications').find({ ...(type && ['shopkeeper', 'employee'].includes(type) ? { type: type as PartnerApplicationType } : {}), ...(status ? { status } : {}) }).sort({ submittedAt: -1 }).limit(200).toArray();
  return res.json(applications);
});

admin.patch('/onboarding/applications/:referenceId/status', async (req, res) => {
  const db = mongoDb();
  if (!db) return res.status(503).json({ error: 'MongoDB is required for onboarding approvals' });
  const status = req.body?.status;
  if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
  const updated = await db.collection('onboardingApplications').findOneAndUpdate({ referenceId: req.params.referenceId, status: 'PENDING_REVIEW' }, { $set: { status, reviewedBy: req.user!.id, reviewedAt: new Date().toISOString() } }, { returnDocument: 'after' });
  if (!updated) return res.status(404).json({ error: 'Pending application not found' });
  return res.json(updated);
});

admin.get('/sales-imports', async (_req, res) => {
  const db = mongoDb();
  if (!db) return res.status(503).json({ error: 'MongoDB is required for CSV approvals' });
  const imports = await db.collection<SalesImport>('salesImports').find({ status: 'PENDING_REVIEW' }).sort({ submittedAt: -1 }).limit(100).project({ csv: 0 }).toArray();
  return res.json(imports);
});

admin.post('/sales-imports/:referenceId/approve', async (req, res) => {
  try { return res.json(await approveSalesImport(req.params.referenceId, req.user!.id)); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to approve CSV' }); }
});

admin.post('/sales-imports/:referenceId/reject', async (req, res) => {
  try { return res.json(await rejectSalesImport(req.params.referenceId, req.user!.id, typeof req.body?.reason === 'string' ? req.body.reason : 'Rejected during admin review')); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to reject CSV' }); }
});

