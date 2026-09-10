import { MongoClient } from 'mongodb';

export async function ensureIndexes(client: MongoClient) {
  const db = client.db(process.env.MONGODB_DB || 'freshcart');
  await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
  await db.collection('users').createIndex({ phone: 1 }, { unique: true, sparse: true });
  await db.collection('shops').createIndex({ active: 1 });
  await db.collection('products').createIndex({ shopId: 1, category: 1, active: 1 });
  await db.collection('products').createIndex({ barcode: 1 }, { unique: true, sparse: true });
  await db.collection('orders').createIndex({ customerId: 1, createdAt: -1 });
  await db.collection('orders').createIndex({ shopId: 1, status: 1, createdAt: -1 });
}
