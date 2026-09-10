import crypto from 'node:crypto';
import { mongoDb } from '../db/mongodb.ts';

export type CredentialKind = 'shopkeeper' | 'employee';
export interface PartnerCredentialEntry {
  kind: CredentialKind;
  slot: number;
  loginId: string;
  encryptedPassword: string;
  assignedToId?: string;
  assignedAt?: string;
  active: boolean;
}

const TOTAL = 100;
const prefixes: Record<CredentialKind, string> = { shopkeeper: 'FC-SHOP-', employee: 'FC-EMP-' };

function encryptionKey() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET is required to protect credential secrets');
  return crypto.createHash('sha256').update(secret).digest();
}
function encryptPassword(password: string) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv); const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]); const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}
export function decryptPassword(payload: string) {
  const [ivText, tagText, cipherText] = payload.split('.'); const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url')); decipher.setAuthTag(Buffer.from(tagText, 'base64url')); return Buffer.concat([decipher.update(Buffer.from(cipherText, 'base64url')), decipher.final()]).toString('utf8');
}
function passwordForSlot(kind: CredentialKind, slot: number) { const random = crypto.randomBytes(8).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10); return `${kind === 'shopkeeper' ? 'Shop' : 'Emp'}${String(slot).padStart(4, '0')}-${random}!`; }
export function generateCredentialBatch(kind: CredentialKind) { return Array.from({ length: TOTAL }, (_, index) => { const slot = index + 1; const password = passwordForSlot(kind, slot); return { kind, slot, loginId: `${prefixes[kind]}${String(slot).padStart(4, '0')}`, password, encryptedPassword: encryptPassword(password) }; }); }
export async function ensurePartnerCredentialPools() {
  const db = mongoDb(); if (!db) return; const collection = db.collection<PartnerCredentialEntry>('partnerCredentialPool');
  for (const kind of ['shopkeeper', 'employee'] as const) {
    const count = await collection.countDocuments({ kind }); if (count >= TOTAL) continue;
    const present = new Set((await collection.find({ kind }, { projection: { slot: 1 } }).toArray()).map(row => row.slot));
    for (const item of generateCredentialBatch(kind)) if (!present.has(item.slot)) { await collection.insertOne({ kind: item.kind, slot: item.slot, loginId: item.loginId, encryptedPassword: item.encryptedPassword, active: true }); }
  }
}
export async function listPartnerCredentialPool(kind: CredentialKind) {
  const db = mongoDb(); if (!db) return []; const rows = await db.collection<PartnerCredentialEntry>('partnerCredentialPool').find({ kind }).sort({ slot: 1 }).toArray();
  return rows.map(row => ({ slot: row.slot, loginId: row.loginId, password: decryptPassword(row.encryptedPassword), assignedToId: row.assignedToId, assignedAt: row.assignedAt, active: row.active }));
}
export async function claimPartnerCredential(kind: CredentialKind, slot: number, assignedToId: string) {
  const db = mongoDb(); if (!db) return null; return db.collection<PartnerCredentialEntry>('partnerCredentialPool').findOneAndUpdate({ kind, slot, active: true, $or: [{ assignedToId: { $exists: false } }, { assignedToId: null }] }, { $set: { assignedToId, assignedAt: new Date().toISOString() } }, { returnDocument: 'after' });
}
export function credentialPrefix(kind: CredentialKind) { return prefixes[kind]; }
