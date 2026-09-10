import { MongoClient, Db } from 'mongodb';
import { ensureIndexes } from './schema.ts';
import { hashPassword, isStrongPassword } from '../auth/password.ts';
import type { User } from '../models/domain.ts';

let client: MongoClient | null = null;
let db: Db | null = null;

async function ensureAdminAccount(database: Db) {
  const identifier = (process.env.ADMIN_LOGIN_ID || '').trim().toLowerCase();
  const password = process.env.ADMIN_LOGIN_PASSWORD || '';
  if (!identifier || !password) return;
  if (!isStrongPassword(password)) throw new Error('ADMIN_LOGIN_PASSWORD must be 8-128 characters and contain letters and numbers');

  const existing = await database.collection<User>('users').findOne({
    $or: [{ email: identifier }, { phone: identifier }],
  });

  if (existing) {
    if (!['admin', 'super_admin'].includes(existing.role)) {
      throw new Error('ADMIN_LOGIN_ID is already used by a non-admin account');
    }
    if (!existing.active) {
      await database.collection<User>('users').updateOne({ id: existing.id }, { $set: { active: true } });
    }
    return;
  }

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const user: User = {
    id: 'admin-owner',
    name: 'FreshCart Owner',
    email: looksLikeEmail ? identifier : 'admin@freshcart.in',
    phone: looksLikeEmail ? (process.env.ADMIN_LOGIN_PHONE || '9999999999') : identifier,
    role: 'super_admin',
    active: true,
    passwordHash: hashPassword(password),
  };

  await database.collection<User>('users').updateOne(
    { id: user.id },
    { $set: user },
    { upsert: true },
  );
  console.log(`FreshCart owner admin account ready: ${user.email}`);
}

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (db) return db;
  client = new MongoClient(uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'freshcart');
  await ensureIndexes(client);
  await ensureAdminAccount(db);
  return db;
}

export function mongoDb() { return db; }
export function mongoClient() { return client; }

export async function closeMongo() {
  if (client) await client.close();
  client = null;
  db = null;
}
