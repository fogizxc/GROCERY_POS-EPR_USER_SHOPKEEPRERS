import { Router } from 'express';
import crypto from 'node:crypto';
import { mongoDb } from '../db/mongodb';
import { createUser } from '../db/repositories';
import { hashPassword } from '../auth/password';
import type { Shop, User } from '../models/domain';

export const partnerAdmin = Router();

const randomId = (prefix: string) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  let value = '';
  for (let i = 0; i < 10; i += 1) value += alphabet[bytes[i] % alphabet.length];
  return `${prefix}${value}`;
};

const randomPassword = () => {
  let value = '';
  while (value.length < 12) value += crypto.randomInt(0, 10).toString();
  return value.slice(0, 12);
};

async function uniqueUsername(prefix: string, db: NonNullable<ReturnType<typeof mongoDb>>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username = randomId(prefix).toUpperCase();
    if (!(await db.collection<User>('users').findOne({ username }))) return username;
  }
  throw new Error('Unable to generate a unique login ID');
}

partnerAdmin.post('/create', async (req, res) => {
  const db = mongoDb();
  if (!db) return res.status(503).json({ error: 'MongoDB is required to create partner accounts' });

  const kind = req.body?.kind === 'employee' ? 'employee' : req.body?.kind === 'shopkeeper' ? 'shopkeeper' : null;
  if (!kind) return res.status(400).json({ error: 'Partner type must be shopkeeper or employee' });

  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const phone = String(req.body?.phone ?? '').trim();
  const address = String(req.body?.address ?? '').trim();
  const city = String(req.body?.city ?? '').trim();
  const state = String(req.body?.state ?? '').trim();
  const postalCode = String(req.body?.postalCode ?? '').trim();
  const businessName = String(req.body?.businessName ?? '').trim();
  const designation = String(req.body?.designation ?? '').trim();

  if (!name || !email || !phone || !address || !city || !state || !postalCode) return res.status(400).json({ error: 'Name, email, phone, address, city, state and postal code are required' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (!/^[0-9+()\-\s]{8,20}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number' });
  if (!/^\d{4,10}$/.test(postalCode)) return res.status(400).json({ error: 'Enter a valid postal code' });
  if (kind === 'shopkeeper' && !businessName) return res.status(400).json({ error: 'Shop name is required for a shopkeeper' });

  const existing = await db.collection<User>('users').findOne({ $or: [{ email }, { phone }], active: true });
  if (existing) return res.status(409).json({ error: 'An active account already exists with this email or phone number' });

  const username = await uniqueUsername(kind === 'shopkeeper' ? 'FC-SHOP-' : 'FC-EMP-', db);
  const password = randomPassword();
  const user: User = {
    id: `u-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    name,
    email,
    phone,
    username,
    role: kind,
    active: true,
    passwordHash: hashPassword(password),
  };

  let shop: Shop | undefined;
  try {
    if (kind === 'shopkeeper') {
      shop = { id: `shop-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`, name: businessName, address: `${address}, ${city}, ${state} ${postalCode}`, active: true };
      await db.collection<Shop>('shops').insertOne(shop);
      user.shopId = shop.id;
    } else if (req.body?.shopId) {
      const assignedShop = await db.collection<Shop>('shops').findOne({ id: String(req.body.shopId), active: true });
      if (!assignedShop) return res.status(400).json({ error: 'Selected shop could not be found' });
      user.shopId = assignedShop.id;
    }
    await createUser(user);
  } catch (error) {
    if (shop) await db.collection<Shop>('shops').deleteOne({ id: shop.id });
    console.error('Partner account creation failed:', error);
    return res.status(500).json({ error: 'Unable to create partner account' });
  }

  return res.status(201).json({
    partner: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, designation: designation || undefined, shopId: user.shopId, shopName: shop?.name },
    credentials: { loginId: username, password },
    message: `${kind === 'shopkeeper' ? 'Shopkeeper and shop' : 'Employee'} created successfully. Save the generated credentials now; the password is not stored in plaintext.`,
  });
});
