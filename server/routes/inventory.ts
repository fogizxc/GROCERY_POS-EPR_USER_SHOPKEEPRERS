import { Router } from 'express';
import { requireAuth } from '../auth/middleware.ts';
import type { Product } from '../models/domain.ts';
import { mongoDb, } from '../db/mongodb.ts';
import { updateStock } from '../db/repositories.ts';

export const inventory = Router();

inventory.patch('/products/:id/stock', requireAuth, async (req, res) => {
  const stock = Number(req.body?.stock);
  if (!Number.isFinite(stock) || stock < 0 || stock > 1_000_000) return res.status(400).json({ error: 'Stock must be a finite number between 0 and 1,000,000' });

  if (mongoDb()) {
    const db = mongoDb()!;
    const product = await db.collection<Product>('products').findOne({ id: req.params.id, active: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    const isStaff = ['shopkeeper', 'employee', 'store_manager'].includes(req.user?.role ?? '');
    if (!isAdmin && !(isStaff && product.shopId && product.shopId === req.user?.shopId)) return res.status(403).json({ error: 'Insufficient permissions' });

    const updated = await updateStock(product.id, stock, isAdmin ? undefined : req.user?.shopId, { id: req.user!.id, role: req.user!.role });
    return updated ? res.json(updated) : res.status(409).json({ error: 'Stock update could not be applied' });
  }

  return res.status(503).json({ error: 'Inventory mutation requires persistent MongoDB storage' });
});
