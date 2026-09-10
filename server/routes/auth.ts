import { Router } from 'express';
import type { Role } from '../models/domain';
import { getSession, signIn, signOut } from '../auth/auth';

export const auth = Router();

auth.post('/login', (req, res) => {
  const { identifier, role } = req.body ?? {};
  const session = signIn(String(identifier ?? ''), role as Role);
  if (!session) return res.status(401).json({ error: 'Invalid account or role' });
  res.json({ token: session.token, user: session.user, expiresAt: session.expiresAt });
});

auth.get('/me', (req, res) => {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const session = getSession(token);
  return session ? res.json(session.user) : res.status(401).json({ error: 'Authentication required' });
});

auth.post('/logout', (req, res) => {
  signOut(req.header('authorization')?.replace(/^Bearer\s+/i, ''));
  res.status(204).send();
});
