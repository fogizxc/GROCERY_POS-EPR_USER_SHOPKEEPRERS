import { Router } from 'express';
import { mongoDb } from '../db/mongodb';
import { products, shops } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import type { Product, Shop } from '../models/domain';

export const adminCatalog = Router();
adminCatalog.use(requireAuth, requireRole('admin', 'super_admin'));
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nonNegative = (value: unknown) => Number.isFinite(Number(value)) && Number(value) >= 0;

adminCatalog.post('/products', async (req, res) => {
  const body = req.body ?? {};
  const product: Product = { id: text(body.id) || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, sku: text(body.sku), barcode: text(body.barcode) || undefined, name: text(body.name), category: text(body.category), unit: text(body.unit), mrp: Number(body.mrp), sellingPrice: Number(body.sellingPrice), stock: Number(body.stock ?? 0), minStock: Number(body.minStock ?? 0), shopId: text(body.shopId) || undefined, imageUrl: text(body.imageUrl) || undefined, active: body.active !== false };
  if (!product.sku || !product.name || !product.category || !product.unit || !nonNegative(product.mrp) || !nonNegative(product.sellingPrice) || !nonNegative(product.stock) || !nonNegative(product.minStock) || product.sellingPrice > product.mrp) return res.status(400).json({ error: 'Valid sku, name, category, unit and non-negative pricing/stock are required; sellingPrice cannot exceed mrp' });
  if (mongoDb()) { try { await mongoDb()!.collection<Product>('products').insertOne(product); return res.status(201).json(product); } catch (error) { return res.status(409).json({ error: error instanceof Error && /duplicate/i.test(error.message) ? 'SKU or barcode already exists' : 'Unable to create product' }); } }
  products.push(product); return res.status(201).json(product);
});

adminCatalog.patch('/products/:id', async (req, res) => {
  const body = req.body ?? {}; const set: Partial<Product> = {};
  for (const key of ['sku','barcode','name','category','unit','shopId','imageUrl'] as const) if (body[key] !== undefined) set[key] = text(body[key]) || undefined;
  for (const key of ['mrp','sellingPrice','stock','minStock'] as const) if (body[key] !== undefined) { if (!nonNegative(body[key])) return res.status(400).json({ error: `${key} must be non-negative` }); set[key] = Number(body[key]); }
  if (body.active !== undefined) set.active = Boolean(body.active);
  if (mongoDb()) { const current = await mongoDb()!.collection<Product>('products').findOne({ id: req.params.id }); if (!current) return res.status(404).json({ error: 'Product not found' }); const mrp = set.mrp ?? current.mrp; const price = set.sellingPrice ?? current.sellingPrice; if (price > mrp) return res.status(400).json({ error: 'sellingPrice cannot exceed mrp' }); try { const updated = await mongoDb()!.collection<Product>('products').findOneAndUpdate({ id: req.params.id }, { $set: set }, { returnDocument: 'after' }); return res.json(updated); } catch { return res.status(409).json({ error: 'SKU or barcode already exists' }); } }
  const product = products.find(p => p.id === req.params.id); if (!product) return res.status(404).json({ error: 'Product not found' }); Object.assign(product, set); if (product.sellingPrice > product.mrp) return res.status(400).json({ error: 'sellingPrice cannot exceed mrp' }); return res.json(product);
});

adminCatalog.patch('/products/:id/active', async (req, res) => { if (mongoDb()) { const updated = await mongoDb()!.collection<Product>('products').findOneAndUpdate({ id: req.params.id }, { $set: { active: Boolean(req.body?.active) } }, { returnDocument: 'after' }); return updated ? res.json(updated) : res.status(404).json({ error: 'Product not found' }); } const product = products.find(p => p.id === req.params.id); if (!product) return res.status(404).json({ error: 'Product not found' }); product.active = Boolean(req.body?.active); return res.json(product); });

adminCatalog.post('/shops', async (req, res) => { const shop: Shop = { id: text(req.body?.id) || `shop-${Date.now()}`, name: text(req.body?.name), address: text(req.body?.address), active: req.body?.active !== false }; if (!shop.name || !shop.address) return res.status(400).json({ error: 'Shop name and address are required' }); if (mongoDb()) { await mongoDb()!.collection<Shop>('shops').insertOne(shop); return res.status(201).json(shop); } shops.push(shop); return res.status(201).json(shop); });
adminCatalog.patch('/shops/:id', async (req, res) => { const set: Partial<Shop> = {}; if (req.body?.name !== undefined) set.name = text(req.body.name); if (req.body?.address !== undefined) set.address = text(req.body.address); if (req.body?.active !== undefined) set.active = Boolean(req.body.active); if (mongoDb()) { const updated = await mongoDb()!.collection<Shop>('shops').findOneAndUpdate({ id: req.params.id }, { $set: set }, { returnDocument: 'after' }); return updated ? res.json(updated) : res.status(404).json({ error: 'Shop not found' }); } const shop = shops.find(s => s.id === req.params.id); if (!shop) return res.status(404).json({ error: 'Shop not found' }); Object.assign(shop, set); return res.json(shop); });
