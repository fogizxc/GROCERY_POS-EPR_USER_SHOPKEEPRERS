import crypto from 'node:crypto';
import { mongoDb } from '../db/mongodb.ts';

export type CredentialKind = 'shopkeeper' | 'employee';
export interface PartnerCredentialEntry { kind: CredentialKind; slot: number; baseLoginId: string; encryptedBasePassword: string; assignedToId?: string; assignedAt?: string; active: boolean; }

const TOTAL = 100;
function encryptionKey() { const secret = process.env.JWT_SECRET?.trim(); if (!secret || secret.length < 32) throw new Error('JWT_SECRET is required to protect credential secrets'); return crypto.createHash('sha256').update(secret).digest(); }
function encryptPassword(password: string) { const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv); const ciphertext=Buffer.concat([cipher.update(password,'utf8'),cipher.final()]); const tag=cipher.getAuthTag(); return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`; }
export function decryptPassword(payload: string) { const [ivText,tagText,cipherText]=payload.split('.'); if(!ivText||!tagText||!cipherText)throw new Error('Stored credential secret is invalid'); const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(ivText,'base64url')); decipher.setAuthTag(Buffer.from(tagText,'base64url')); return Buffer.concat([decipher.update(Buffer.from(cipherText,'base64url')),decipher.final()]).toString('utf8'); }
function random18Digits() { let value=''; while(value.length<18)value+=crypto.randomInt(0,10).toString(); return value.slice(0,18); }
function newBase() { return { baseLoginId:random18Digits(), encryptedBasePassword:encryptPassword(random18Digits()), active:true }; }
function generateCredentialBatch(kind:CredentialKind) { return Array.from({length:TOTAL},(_,index)=>({kind,slot:index+1,...newBase()})); }
export async function ensurePartnerCredentialPools() {
  const db=mongoDb(); if(!db)throw new Error('MongoDB is required for the credential vault'); const collection=db.collection<PartnerCredentialEntry>('partnerCredentialPool');
  for(const kind of ['shopkeeper','employee'] as const) {
    const rows=await collection.find({kind}).toArray(); const present=new Set(rows.map(row=>row.slot));
    for(const row of rows) if(!row.assignedToId&&(!row.baseLoginId||!row.encryptedBasePassword)) await collection.updateOne({_id:(row as any)._id,kind,slot:row.slot},{$set:newBase()});
    for(const item of generateCredentialBatch(kind)) if(!present.has(item.slot)) await collection.insertOne(item);
  }
}
export async function listPartnerCredentialPool(kind:CredentialKind) { const db=mongoDb(); if(!db)throw new Error('MongoDB is required for the credential vault'); const rows=await db.collection<PartnerCredentialEntry>('partnerCredentialPool').find({kind}).sort({slot:1}).toArray(); return rows.map(row=>({slot:row.slot,baseLoginId:row.baseLoginId,basePassword:row.encryptedBasePassword?decryptPassword(row.encryptedBasePassword):undefined,assignedToId:row.assignedToId,assignedAt:row.assignedAt,active:row.active})); }
export async function getPartnerCredentialBase(kind:CredentialKind,slot:number) { const db=mongoDb(); if(!db)return null; const row=await db.collection<PartnerCredentialEntry>('partnerCredentialPool').findOne({kind,slot,active:true}); if(!row||!row.baseLoginId||!row.encryptedBasePassword)return null; return {slot:row.slot,baseLoginId:row.baseLoginId,basePassword:decryptPassword(row.encryptedBasePassword),assignedToId:row.assignedToId,assignedAt:row.assignedAt}; }
export async function claimPartnerCredential(kind:CredentialKind,slot:number,assignedToId:string) { const db=mongoDb(); if(!db)return null; return db.collection<PartnerCredentialEntry>('partnerCredentialPool').findOneAndUpdate({kind,slot,active:true,$or:[{assignedToId:{$exists:false}},{assignedToId:null}]},{$set:{assignedToId,assignedAt:new Date().toISOString()}},{returnDocument:'after'}); }
export function credentialPrefix(kind:CredentialKind) { return kind==='shopkeeper'?'FC-SHOP-':'FC-EMP-'; }
