import { ObjectId } from 'mongodb';
import type { Order, Product, User } from '../models/domain';
import type { Address, DeliverySlot, Payment } from '../models/catalog';
import { mongoDb } from './mongodb';

export async function findUser(identifier: string, role: string) {
  const db = mongoDb();
  return db ? db.collection<User>('users').findOne({ $or: [{ email: identifier }, { phone: identifier }], role, active: true }) : null;
}

export async function listProducts(shopId?: string) {
  const db = mongoDb();
  return db ? db.collection<Product>('products').find({ active: true, ...(shopId ? { shopId } : {}) }).toArray() : [];
}

export async function listAddresses(userId: string) {
  const db = mongoDb();
  return db ? db.collection<Address>('addresses').find({ userId }).sort({ isDefault: -1 }).toArray() : [];
}

export async function insertAddress(address: Address) {
  const db = mongoDb();
  if (!db) return;
  await db.collection<Address>('addresses').insertOne(address);
}

export async function listDeliverySlots() {
  const db = mongoDb();
  return db ? db.collection<DeliverySlot>('deliverySlots').find({ active: true }).sort({ startsAt: 1 }).toArray() : [];
}

export async function reserveStock(shopId: string, productId: string, quantity: number) {
  const db = mongoDb();
  if (!db) return true;
  const result = await db.collection<Product>('products').findOneAndUpdate(
    { id: productId, shopId, active: true, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { returnDocument: 'after' },
  );
  return Boolean(result);
}

export async function insertOrder(order: Order) {
  const db = mongoDb();
  if (!db) return;
  await db.collection<Order>('orders').insertOne({ ...order, _id: new ObjectId() } as Order & { _id: ObjectId });
}

export async function insertPayment(payment: Payment) {
  const db = mongoDb();
  if (!db) return;
  await db.collection<Payment>('payments').insertOne(payment);
}

export async function findOrders(filter: Record<string, unknown> = {}) {
  const db = mongoDb();
  return db ? db.collection<Order>('orders').find(filter).sort({ createdAt: -1 }).toArray() : [];
}
