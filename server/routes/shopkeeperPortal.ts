import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.ts';
import { mongoDb } from '../db/mongodb.ts';
import type { Product } from '../models/domain.ts';

export const shopkeeperPortal = Router();
shopkeeperPortal.use(requireAuth, requireRole('shopkeeper', 'store_manager'));

shopkeeperPortal.get('/products', async (req, res) => {
  const shopId = req.user?.shopId;
  if (!shopId) return res.status(400).json({ error: 'Shopkeeper account is not assigned to a shop' });
  const db = mongoDb();
  if (!db) return res.status(503).json({ error: 'MongoDB is required for the shopkeeper portal' });
  return res.json(await db.collection<Product>('products').find({ shopId, active: true }).sort({ name: 1 }).toArray());
});

shopkeeperPortal.patch('/products/:id/stock', async (req, res) => {
  const shopId = req.user?.shopId;
  const stock = Number(req.body?.stock);
  if (!shopId) return res.status(400).json({ error: 'Shopkeeper account is not assigned to a shop' });
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) return res.status(400).json({ error: 'Stock must be a whole number from 0 to 1000000' });
  const db = mongoDb();
  if (!db) return res.status(503).json({ error: 'MongoDB is required for the shopkeeper portal' });
  const current = await db.collection<Product>('products').findOne({ id: req.params.id, shopId });
  if (!current) return res.status(404).json({ error: 'Product not found in your shop' });
  const result = await db.collection<Product>('products').findOneAndUpdate({ id: req.params.id, shopId }, { $set: { stock } }, { returnDocument: 'after' });
  if (!result) return res.status(404).json({ error: 'Product not found in your shop' });
  const now = new Date().toISOString();
  await db.collection('auditLogs').insertOne({ id: `audit-${Date.now()}-${Math.random().toString(36).slice(0, 8)}`, actorId: req.user!.id, actorRole: req.user!.role, action: 'INVENTORY_STOCK_UPDATE', entity: 'product', entityId: current.id, metadata: { shopId, sku: current.sku, previousStock: current.stock, newStock: stock, minStock: current.minStock }, createdAt: now });
  if (stock <= current.minStock && current.stock > current.minStock) {
    const shop = await db.collection('shops').findOne({ id: shopId });
    const recipients = new Set<string>();
    if (shop?.shopkeeperId) recipients.add(shop.shopkeeperId as string);
    const managers = await db.collection('users').find({ shopId, role: 'store_manager', active: true }).project({ id: 1 }).limit(25).toArray();
    for (const manager of managers) recipients.add(manager.id as string);
    if (recipients.size) await db.collection('notifications').insertMany([...recipients].map(userId => ({ id: `notif-stock-${Date.now()}-${Math.random().toString(36).slice(0, 8)}-${userId}`, userId, title: `Low stock: ${current.name}`, message: `${current.name} (${current.sku}) is at ${stock} ${current.unit}; minimum is ${current.minStock}.`, type: 'STOCK', read: false, createdAt: now })));
  }
  return res.json(result);
});

shopkeeperPortal.get('/sales-imports', async (req, res) => {
  const shopId = req.user?.shopId; if (!shopId) return res.status(400).json({ error: 'Shopkeeper account is not assigned to a shop' });
  const db = mongoDb(); if (!db) return res.status(503).json({ error: 'MongoDB is required for sales history' });
  const rows = await db.collection('salesImports').find({ shopId, submittedBy: req.user!.id }).sort({ submittedAt: -1 }).limit(50).project({ csv: 0 }).toArray();
  return res.json(rows);
});
