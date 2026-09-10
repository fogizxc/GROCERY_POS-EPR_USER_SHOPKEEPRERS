import { Router } from 'express';
import { products, orders } from '../store/memoryStore.ts';
import { requireAuth, requireRole } from '../auth/middleware.ts';
import type { OrderStatus } from '../models/domain.ts';
import { mongoDb } from '../db/mongodb.ts';
import { findOrders, listProducts, updateOrderStatus, updateStock } from '../db/repositories.ts';
import { parseSalesCsv, type SalesImportRecord } from '../lib/salesImport.ts';

export const shopkeeper = Router();
shopkeeper.use(requireAuth, requireRole('shopkeeper', 'employee', 'store_manager'));

shopkeeper.get('/orders', async (req, res) => {
  const shopId = req.user!.shopId;
  if (!shopId) return res.status(403).json({ error: 'No shop is assigned to this account' });
  if (mongoDb()) return res.json(await findOrders({ shopId }));
  return res.json(orders.filter(o => o.shopId === shopId));
});

shopkeeper.get('/products', requireRole('shopkeeper'), async (req, res) => {
  const shopId = req.user!.shopId;
  if (!shopId) return res.status(403).json({ error: 'No shop is assigned to this account' });
  if (mongoDb()) return res.json(await listProducts(shopId));
  return res.json(products.filter(p => p.active && p.shopId === shopId));
});

shopkeeper.get('/stock-alerts', async (req, res) => {
  const shopId = req.user!.shopId;
  if (!shopId) return res.status(403).json({ error: 'No shop is assigned to this account' });
  if (mongoDb()) return res.json((await listProducts(shopId)).filter(p => p.stock <= p.minStock));
  return res.json(products.filter(p => p.shopId === shopId && p.stock <= p.minStock));
});

shopkeeper.patch('/orders/:id/status', async (req, res) => {
  const status = req.body?.status as OrderStatus;
  const allowed: OrderStatus[] = ['ACCEPTED', 'PICKING', 'PACKING', 'READY', 'CANCELLED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid shop order status' });
  if (!req.user!.shopId) return res.status(403).json({ error: 'No shop is assigned to this account' });
  if (mongoDb()) { const result = await mongoDb()!.collection<import('../models/domain').Order>('orders').findOne({ id: req.params.id, shopId: req.user!.shopId }); if (!result) return res.status(404).json({ error: 'Order not found in assigned shop' }); const updated = await updateOrderStatus(result.id, status); return res.json(updated); }
  const order = orders.find(o => o.id === req.params.id && o.shopId === req.user?.shopId); if (!order) return res.status(404).json({ error: 'Order not found in assigned shop' }); order.status = status; return res.json(order);
});

shopkeeper.patch('/products/:id/stock', requireRole('shopkeeper'), async (req, res) => {
  const stock = Number(req.body?.stock); if (!Number.isFinite(stock) || stock < 0) return res.status(400).json({ error: 'Invalid stock' });
  if (!req.user!.shopId) return res.status(403).json({ error: 'No shop is assigned to this account' });
  if (mongoDb()) { const product = await mongoDb()!.collection<import('../models/domain').Product>('products').findOne({ id: req.params.id, shopId: req.user!.shopId }); if (!product) return res.status(404).json({ error: 'Product not found in assigned shop' }); const updated = await updateStock(product.id, stock); return res.json(updated); }
  const product = products.find(p => p.id === req.params.id && p.shopId === req.user?.shopId); if (!product) return res.status(404).json({ error: 'Product not found in assigned shop' }); product.stock = stock; return res.json(product);
});

shopkeeper.post('/sales-imports', requireRole('shopkeeper'), async (req, res) => {
  const shopId = req.user!.shopId;
  const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim().slice(0, 160) : '';
  const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
  if (!shopId) return res.status(403).json({ error: 'No shop is assigned to this account' });
  if (!fileName.toLowerCase().endsWith('.csv')) return res.status(400).json({ error: 'A CSV file is required' });
  if (!csv || Buffer.byteLength(csv, 'utf8') > 2 * 1024 * 1024) return res.status(400).json({ error: 'CSV must be present and no larger than 2 MB' });
  let rows;
  try { rows = parseSalesCsv(csv); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid CSV' }); }
  if (rows.length > 5000) return res.status(400).json({ error: 'CSV cannot contain more than 5000 data rows' });
  const application: SalesImportRecord = {
    referenceId: `FC-CSV-${Date.now().toString(36).toUpperCase()}`,
    shopId,
    fileName,
    csv,
    rowCount: rows.length,
    status: 'PENDING_REVIEW',
    submittedBy: req.user!.id,
    submittedAt: new Date().toISOString(),
  };
  const db = mongoDb();
  if (!db) return res.status(503).json({ error: 'CSV approval requires the production database connection' });
  await db.collection<SalesImportRecord>('salesImports').insertOne(application);
  return res.status(201).json({ referenceId: application.referenceId, rowCount: application.rowCount, status: application.status });
});
