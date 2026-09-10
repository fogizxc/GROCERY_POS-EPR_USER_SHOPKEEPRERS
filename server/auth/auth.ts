import crypto from 'node:crypto';
import type { Role, User } from '../models/domain';
import { users } from '../store/memoryStore';

export interface Session { token: string; user: User; expiresAt: number; }
const sessions = new Map<string, Session>();

export function signIn(identifier: string, role: Role): Session | null {
  const user = users.find(u => u.active && (u.email === identifier || u.phone === identifier) && u.role === role);
  if (!user) return null;
  const token = crypto.randomBytes(24).toString('hex');
  const session = { token, user, expiresAt: Date.now() + 1000 * 60 * 60 * 12 };
  sessions.set(token, session);
  return session;
}

export function getSession(token?: string) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (session) sessions.delete(token); return null; }
  return session;
}

export function signOut(token?: string) { if (token) sessions.delete(token); }
