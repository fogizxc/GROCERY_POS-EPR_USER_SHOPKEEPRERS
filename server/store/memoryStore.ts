import type { Order, Product, Shop, User } from '../models/domain';

export const shops: Shop[] = [
  { id: 'shop-1', name: 'GreenLeaf Market', address: 'Connaught Place, New Delhi', active: true },
  { id: 'shop-2', name: 'Daily Basket', address: 'Lajpat Nagar, New Delhi', active: true },
];

export const users: User[] = [
  { id: 'u-1', name: 'Riya Mehta', email: 'riya@example.com', phone: '9000000001', role: 'customer', active: true },
  { id: 'u-2', name: 'Arjun Sharma', email: 'arjun@greenleaf.local', phone: '9000000002', role: 'shopkeeper', shopId: 'shop-1', active: true },
];

export const products: Product[] = [
  { id: 'p-1', sku: 'FR-MNG-001', name: 'Alphonso Mangoes', category: 'Fruits', unit: '1 kg', mrp: 229, sellingPrice: 189, stock: 42, minStock: 10, shopId: 'shop-1', active: true },
  { id: 'p-2', sku: 'VG-SPN-001', name: 'Baby Spinach', category: 'Vegetables', unit: '250 g', mrp: 49, sellingPrice: 42, stock: 18, minStock: 8, shopId: 'shop-1', active: true },
  { id: 'p-3', sku: 'DR-MIL-001', name: 'Farm Fresh Milk', category: 'Dairy & Eggs', unit: '1 L', mrp: 64, sellingPrice: 64, stock: 65, minStock: 15, shopId: 'shop-1', active: true },
  { id: 'p-4', sku: 'PN-BRD-001', name: 'Organic Brown Bread', category: 'Pantry', unit: '400 g', mrp: 65, sellingPrice: 55, stock: 7, minStock: 10, shopId: 'shop-1', active: true },
];

export const orders: Order[] = [];
