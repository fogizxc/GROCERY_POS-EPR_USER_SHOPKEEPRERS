import { Router } from 'express';
import type { Role } from '../models/domain';
import { getSession, signIn } from '../auth/auth';

export const auth = Router();
const roles: Role[] = ['customer', 'shopkeeper', 'employee', 'store_manager', 'admin', 'super_admin'];

auth.post('/login', async (req, res) => {
  const { identifier, role } = req.body ?? {};
  if (typeof identifier !== 'string' || !identifier.trim() || !roles.includes(role as Role)) {
    return res.status(400).json({ error: 'identifier and a valid role are required' });
  }
  try {
    const session = await signIn(identifier, role as Role);
    if (!session) return res.status(401).json({ error: 'Invalid account or role' });
    return res.json({ token: session.token, user: session.user, expiresAt: session.expiresAt });
  } catch (error) {
    console.error(error);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
});

auth.get('/me', async (req, res) => {
  try {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const session = await getSession(token);
    return session ? res.json(session.user) : res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    console.error(error);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
});

auth.post('/logout', (_req, res) => res.status(204).send());
