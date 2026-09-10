import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.ts';
import { mongoDb } from '../db/mongodb.ts';
import type { Product } from '../models/domain.ts';
import { approveSalesImport } from './onboarding.ts';

export const shopkeeperPortal = Router();
shopkeeperPortal.use(requireAuth, requireRole('shopkeeper'));

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
  const result = await db.collection<Product>('products').findOneAndUpdate({ id: req.params.id, shopId }, { $set: { stock } }, { returnDocument: 'after' });
  return result ? res.json(result) : res.status(404).json({ error: 'Product not found in your shop' });
});

shopkeeperPortal.get('/sales-imports', async (req, res) => {
  const shopId = req.user?.shopId; if (!shopId) return res.status(400).json({ error: 'Shopkeeper account is not assigned to a shop' });
  const db = mongoDb(); if (!db) return res.status(503).json({ error: 'MongoDB is required for sales history' });
  const rows = await db.collection('salesImports').find({ shopId, submittedBy: req.user!.id }).sort({ submittedAt: -1 }).limit(50).project({ csv: 0 }).toArray();
  return res.json(rows);
});
