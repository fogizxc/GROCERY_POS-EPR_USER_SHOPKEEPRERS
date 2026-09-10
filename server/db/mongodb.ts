import { MongoClient, Db } from 'mongodb';
import { ensureIndexes } from './schema';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (db) return db;
  client = new MongoClient(uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'freshcart');
  await ensureIndexes(client);
  return db;
}

export function mongoDb() { return db; }
export function mongoClient() { return client; }

export async function closeMongo() {
  if (client) await client.close();
  client = null;
  db = null;
}
