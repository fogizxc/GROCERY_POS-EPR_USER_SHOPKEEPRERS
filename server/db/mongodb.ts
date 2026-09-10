import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'freshcart');
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
    db.collection('products').createIndex({ sku: 1 }, { unique: true }),
    db.collection('orders').createIndex({ createdAt: -1 }),
    db.collection('orders').createIndex({ shopId: 1, status: 1 }),
  ]);
  return db;
}

export function mongoDb() { return db; }
export async function closeMongo() { if (client) await client.close(); client = null; db = null; }
