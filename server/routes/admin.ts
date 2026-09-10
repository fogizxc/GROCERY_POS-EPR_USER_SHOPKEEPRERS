import { Router } from 'express';
import { products, orders, shops, users } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { findOrders, listProducts, listShops, listStaff } from '../db/repositories';
import { adminCatalog } from './adminCatalog';

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
