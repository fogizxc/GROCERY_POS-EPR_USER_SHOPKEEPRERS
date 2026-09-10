import { ObjectId } from 'mongodb';
import type { Order, Product, User } from '../models/domain';
import { mongoDb } from './mongodb';

export async function findUser(identifier: string, role: string) {
  const db = mongoDb();
  return db ? db.collection<User>('users').findOne({ $or: [{ email: identifier }, { phone: identifier }], role, active: true }) : null;
}
export async function listProducts(shopId?: string) {
  const db = mongoDb();
  return db ? db.collection<Product>('products').find({ active: true, ...(shopId ? { shopId } : {}) }).toArray() : [];
}
export async function insertOrder(order: Order) {
  const db = mongoDb();
  if (!db) return;
  await db.collection<Order>('orders').insertOne({ ...order, _id: new ObjectId(order.id.slice(-24).padStart(24, '0')) } as Order & { _id: ObjectId });
}
export async function findOrders(filter: Record<string, unknown> = {}) {
  const db = mongoDb();
  return db ? db.collection<Order>('orders').find(filter).sort({ createdAt: -1 }).toArray() : [];
}
