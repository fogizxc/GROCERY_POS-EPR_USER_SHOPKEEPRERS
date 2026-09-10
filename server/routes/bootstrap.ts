import { Router } from 'express';
import { products, shops } from '../store/memoryStore';

export const bootstrap = Router();
bootstrap.get('/', (_req, res) => res.json({ shops, featuredProducts: products.filter(p => p.active).slice(0, 8), categories: [...new Set(products.map(p => p.category))] }));
