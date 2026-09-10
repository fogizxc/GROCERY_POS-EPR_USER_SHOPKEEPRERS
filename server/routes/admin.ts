import { Router } from 'express';
import { products, orders, shops, users } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';

export const admin = Router();
admin.use(requireAuth, requireRole('admin', 'super_admin'));

admin.get('/dashboard', (_req, res) => {
  const activeOrders = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status));
  const revenue = orders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.total, 0);
  res.json({ revenue, activeOrders: activeOrders.length, products: products.length, lowStock: products.filter(p => p.stock <= p.minStock).length, shops: shops.filter(s => s.active).length, staff: users.filter(u => u.active && u.role !== 'customer').length });
});

admin.get('/products', (_req, res) => res.json(products));
admin.get('/shops', (_req, res) => res.json(shops));
admin.get('/staff', (_req, res) => res.json(users.filter(u => u.role !== 'customer')));
