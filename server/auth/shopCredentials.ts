import crypto from 'node:crypto';
import { mongoDb } from '../db/mongodb.ts';

export interface ShopCredentialPoolEntry {
  slot: number;
  loginId: string;
  passwordHash: string;
  assignedShopId?: string;
  assignedAt?: string;
  active: boolean;
}

const TOTAL = 100;
const PREFIX = 'FC-SHOP-';
const passwordForSlot = (slot: number) => `FC${String(slot).padStart(4, '0')}-${crypto.randomBytes(5).toString('base64url').slice(0, 7)}!`;

export function generateCredentialBatch() {
  return Array.from({ length: TOTAL }, (_, index) => {
    const slot = index + 1;
    const password = passwordForSlot(slot);
    return { slot, loginId: `${PREFIX}${String(slot).padStart(4, '0')}`, password };
  });
}

export async function ensureShopCredentialPool() {
  const db = mongoDb();
  if (!db) return;
  const collection = db.collection<ShopCredentialPoolEntry>('shopCredentialPool');
  const existing = await collection.countDocuments();
  if (existing >= TOTAL) return;
  const docs = generateCredentialBatch();
  for (const item of docs) {
    const already = await collection.findOne({ slot: item.slot });
    if (already) continue;
    const passwordHash = crypto.createHash('sha256').update(item.password).digest('hex');
    await collection.insertOne({ slot: item.slot, loginId: item.loginId, passwordHash, active: true });
  }
}

export async function listShopCredentialPool() {
  const db = mongoDb();
  if (!db) return [];
  return db.collection<ShopCredentialPoolEntry>('shopCredentialPool').find({}, { projection: { passwordHash: 0 } }).sort({ slot: 1 }).toArray();
}

export async function assignShopCredential(slot: number, shopId: string) {
  const db = mongoDb();
  if (!db) return null;
  return db.collection<ShopCredentialPoolEntry>('shopCredentialPool').findOneAndUpdate(
    { slot, active: true, $or: [{ assignedShopId: { $exists: false } }, { assignedShopId: null }] },
    { $set: { assignedShopId: shopId, assignedAt: new Date().toISOString() } },
    { returnDocument: 'after', projection: { passwordHash: 0 } },
  );
}

export function poolLoginPrefix() { return PREFIX; }
