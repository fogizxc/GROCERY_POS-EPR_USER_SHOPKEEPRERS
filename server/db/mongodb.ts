import { MongoClient, Db } from 'mongodb';
import { ensureIndexes } from './schema.ts';
import { hashPassword, isStrongPassword } from '../auth/password.ts';
import type { User } from '../models/domain.ts';

let client: MongoClient | null = null;
let db: Db | null = null;
let connectPromise: Promise<Db | null> | null = null;

async function ensureAdminAccount(database: Db) {
  const identifier = (process.env.SUPER_ADMIN_LOGIN_ID || process.env.ADMIN_LOGIN_ID || '').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_LOGIN_PASSWORD || process.env.ADMIN_LOGIN_PASSWORD || '';
  if (!identifier || !password) return;
  if (!isStrongPassword(password)) throw new Error('SUPER_ADMIN_LOGIN_PASSWORD must be 8-128 characters and contain letters and numbers');

  const existing = await database.collection<User>('users').findOne({ $or: [{ email: identifier }, { phone: identifier }, { username: identifier }] });
  if (existing) {
    if (!['admin', 'super_admin'].includes(existing.role)) throw new Error('SUPER_ADMIN_LOGIN_ID is already used by a non-admin account');
    await database.collection<User>('users').updateOne({ id: existing.id }, { $set: { active: true, role: 'super_admin', passwordHash: hashPassword(password) } });
    return;
  }

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const user: User = {
    id: 'super-admin-owner',
    name: 'FreshCart Super Admin',
    email: looksLikeEmail ? identifier : 'superadmin@freshcart.in',
    phone: looksLikeEmail ? (process.env.SUPER_ADMIN_LOGIN_PHONE || process.env.ADMIN_LOGIN_PHONE || '9999999999') : identifier,
    username: looksLikeEmail ? undefined : identifier,
    role: 'super_admin',
    active: true,
    passwordHash: hashPassword(password),
  };
  await database.collection<User>('users').updateOne({ id: user.id }, { $set: user }, { upsert: true });
  console.log(`FreshCart super admin account ready: ${user.email}`);
}

export async function connectMongo() {
  if (db) return db;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) return null;
    const nextClient = new MongoClient(uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 5000 });
    try {
      await nextClient.connect();
      const nextDb = nextClient.db(process.env.MONGODB_DB || 'freshcart');
      await ensureIndexes(nextClient);

      // A bad super-admin bootstrap credential must not make an otherwise
      // healthy MongoDB connection unusable. The owner login has a separate
      // environment-backed fallback, while partner data must use MongoDB.
      try {
        await ensureAdminAccount(nextDb);
      } catch (error) {
        console.error('FreshCart super-admin bootstrap skipped:', error);
      }

      client = nextClient;
      db = nextDb;
      return nextDb;
    } catch (error) {
      await nextClient.close().catch(() => undefined);
      throw error;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export function mongoDb() { return db; }
export function mongoClient() { return client; }

export async function closeMongo() {
  if (client) await client.close();
  client = null;
  db = null;
  connectPromise = null;
}
