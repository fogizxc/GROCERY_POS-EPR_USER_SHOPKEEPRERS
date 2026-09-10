import { Router } from 'express';
import { mongoDb } from '../db/mongodb';
import { products as memoryProducts, shops as memoryShops } from '../store/memoryStore';

export const bootstrap = Router();

bootstrap.get('/', async (_req, res, next) => {
  try {
    const db = mongoDb();
    if (!db) {
      return res.json({
        shops: memoryShops.filter(shop => shop.active),
        featuredProducts: memoryProducts.filter(product => product.active).slice(0, 8),
        categories: [...new Set(memoryProducts.filter(product => product.active).map(product => product.category))],
      });
    }

    const [shops, featuredProducts, categoryRows] = await Promise.all([
      db.collection('shops').find({ active: true }).sort({ name: 1 }).limit(50).toArray(),
      db.collection('products').find({ active: true }).sort({ name: 1 }).limit(8).toArray(),
      db.collection<{ category: string }>('products').aggregate<{ _id: string }>([
        { $match: { active: true } },
        { $group: { _id: '$category' } },
        { $sort: { _id: 1 } },
      ]).toArray(),
    ]);

    return res.json({
      shops,
      featuredProducts,
      categories: categoryRows.map(row => row._id),
    });
  } catch (error) {
    return next(error);
  }
});
