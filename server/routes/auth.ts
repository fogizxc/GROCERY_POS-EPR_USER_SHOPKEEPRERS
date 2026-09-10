import { Router } from 'express';
import type { Role, User } from '../models/domain.ts';
import { users } from '../store/memoryStore.ts';
import { createUser, findUser } from '../db/repositories.ts';
import { getSession, signIn } from '../auth/auth.ts';
import { hashPassword, isStrongPassword } from '../auth/password.ts';

export const auth = Router();
const roles: Role[] = ['customer', 'shopkeeper', 'employee', 'store_manager', 'admin', 'super_admin'];
const publicUser = (user: User) => { const { passwordHash: _passwordHash, ...safe } = user; return safe; };

auth.post('/login', async (req, res) => {
  const { identifier, password, role } = req.body ?? {};
  if (typeof identifier !== 'string' || !identifier.trim() || !roles.includes(role as Role)) return res.status(400).json({ error: 'identifier and a valid role are required' });
  if (password !== undefined && typeof password !== 'string') return res.status(400).json({ error: 'Password must be a string' });
  try { const session = await signIn(identifier, role as Role, password); if (!session) return res.status(401).json({ error: 'Invalid account, password or role' }); return res.json({ token: session.token, user: publicUser(session.user), expiresAt: session.expiresAt }); }
  catch (error) { console.error(error); return res.status(503).json({ error: 'Authentication service unavailable' }); }
});

auth.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ error: 'A valid name is required' });
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) return res.status(400).json({ error: 'A valid email is required' });
  if (typeof phone !== 'string' || !/^\+?[0-9]{10,15}$/.test(phone.trim())) return res.status(400).json({ error: 'A valid phone number is required' });
  if (!isStrongPassword(password)) return res.status(400).json({ error: 'Password must be 8-128 characters and contain letters and numbers' });
  const normalizedEmail = email.trim().toLowerCase(); const normalizedPhone = phone.trim();
  try {
    const existingMongo = await Promise.all([findUser(normalizedEmail, 'customer'), findUser(normalizedPhone, 'customer')]);
    if (existingMongo.some(Boolean) || users.some(u => u.active && (u.email.toLowerCase() === normalizedEmail || u.phone === normalizedPhone))) return res.status(409).json({ error: 'An account with this email or phone already exists' });
    const user: User = { id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), email: normalizedEmail, phone: normalizedPhone, role: 'customer', active: true, passwordHash: hashPassword(password) };
    if (process.env.MONGODB_URI) await createUser(user); else users.push(user);
    const session = await signIn(normalizedEmail, 'customer', password);
    if (!session) return res.status(503).json({ error: 'Account created but sign-in could not be established' });
    return res.status(201).json({ token: session.token, user: publicUser(session.user), expiresAt: session.expiresAt });
  } catch (error) { console.error(error); return res.status(503).json({ error: 'Unable to create account' }); }
});

auth.get('/me', async (req, res) => { try { const token = req.header('authorization')?.replace(/^Bearer\s+/i, ''); const session = await getSession(token); return session ? res.json(publicUser(session.user)) : res.status(401).json({ error: 'Authentication required' }); } catch (error) { console.error(error); return res.status(503).json({ error: 'Authentication service unavailable' }); } });
auth.post('/logout', (_req, res) => res.status(204).send());
