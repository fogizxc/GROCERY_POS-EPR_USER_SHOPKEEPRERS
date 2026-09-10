import type { Filter, UpdateFilter } from 'mongodb';
import { ObjectId } from 'mongodb';
import type { Order, Product, User, Shop } from '../models/domain';
import type { Address, DeliverySlot, Payment } from '../models/catalog';
import { mongoDb } from './mongodb';

export async function findUser(identifier: string, role: string) {
  const db = mongoDb();
  if (!db) return null;
  return db.collection<User>('users').findOne({ $or: [{ email: identifier }, { phone: identifier }], role, active: true });
}

export async function listProducts(shopId?: string, category?: string, q?: string) {
  const db = mongoDb();
  if (!db) return [];
  const filter: Filter<Product> = { active: true, ...(shopId ? { shopId } : {}), ...(category ? { category } : {}) };
  if (q) filter.$text = { $search: q };
  return db.collection<Product>('products').find(filter).toArray();
}

export async function listShops() {
  const db = mongoDb();
  return db ? db.collection<Shop>('shops').find({ active: true }).toArray() : [];
}

export async function listAddresses(userId: string) {
  const db = mongoDb();
  return db ? db.collection<Address>('addresses').find({ userId }).sort({ isDefault: -1 }).toArray() : [];
}

export async function insertAddress(address: Address) {
  const db = mongoDb();
  if (!db) return;
  if (address.isDefault) await db.collection<Address>('addresses').updateMany({ userId: address.userId }, { $set: { isDefault: false } });
  await db.collection<Address>('addresses').insertOne(address);
}

export async function listDeliverySlots() {
  const db = mongoDb();
  return db ? db.collection<DeliverySlot>('deliverySlots').find({ active: true, $expr: { $lt: ['$booked', '$capacity'] } }).sort({ date: 1, startTime: 1 }).toArray() : [];
}

export async function reserveProductsAndSlot(shopId: string, items: Array<{ productId: string; quantity: number }>, slotId: string) {
  const db = mongoDb();
  if (!db) return { products: [], slot: null };
  const products = [] as Product[];
  for (const item of items) {
    const result = await db.collection<Product>('products').findOneAndUpdate(
      { id: item.productId, shopId, active: true, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } } as UpdateFilter<Product>,
      { returnDocument: 'after' },
    );
    if (!result) {
      for (const reserved of items.slice(0, products.length)) await db.collection<Product>('products').updateOne({ id: reserved.productId, shopId }, { $inc: { stock: reserved.quantity } });
      return { products: [], slot: null };
    }
    products.push(result);
  }
  const slot = await db.collection<DeliverySlot>('deliverySlots').findOneAndUpdate(
    { id: slotId, active: true, $expr: { $lt: ['$booked', '$capacity'] } },
    { $inc: { booked: 1 } },
    { returnDocument: 'after' },
  );
  if (!slot) {
    for (const item of items) await db.collection<Product>('products').updateOne({ id: item.productId, shopId }, { $inc: { stock: item.quantity } });
    return { products: [], slot: null };
  }
  return { products, slot };
}

export async function insertOrder(order: Order) {
  const db = mongoDb();
  if (!db) return;
  await db.collection<Order>('orders').insertOne(order);
}

export async function insertPayment(payment: Payment) {
  const db = mongoDb();
  if (!db) return;
  await db.collection<Payment>('payments').insertOne(payment);
}

export async function findOrders(filter: Filter<Order> = {}) {
  const db = mongoDb();
  return db ? db.collection<Order>('orders').find(filter).sort({ createdAt: -1 }).toArray() : [];
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  const db = mongoDb();
  if (!db) return null;
  return db.collection<Order>('orders').findOneAndUpdate({ id: orderId }, { $set: { status } }, { returnDocument: 'after' });
}
