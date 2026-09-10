import type { Role, User } from '../models/domain.ts';
import { users } from '../store/memoryStore.ts';
import { findUser } from '../db/repositories.ts';
import { signToken, verifyToken } from './jwt.ts';
import { verifyPassword } from './password.ts';

export interface Session { token: string; user: User; expiresAt: number; }

export async function signIn(identifier: string, role: Role, password?: string): Promise<Session | null> {
  const normalized = identifier.trim().toLowerCase();
  const mongoUser = await findUser(normalized, role);
  const user = mongoUser ?? users.find(u => u.active && (u.email.toLowerCase() === normalized || u.phone === identifier.trim()) && u.role === role);
  if (!user) return null;
  const production = process.env.NODE_ENV === 'production';
  if (production || user.passwordHash) {
    if (!password || !user.passwordHash || !verifyPassword(password, user.passwordHash)) return null;
  }
  const token = signToken(user);
  return { token, user: { ...user, passwordHash: undefined }, expiresAt: Date.now() + 1000 * 60 * 60 * 12 };
}

export async function getUserFromToken(token?: string) {
  if (!token) return null;
  const claims = verifyToken(token);
  if (!claims) return null;
  const dbUser = await findUser(claims.sub, claims.role);
  if (dbUser) return { ...dbUser, passwordHash: undefined };
  const user = users.find(u => u.active && u.id === claims.sub && u.role === claims.role);
  return user ? { ...user, passwordHash: undefined } : null;
}

export async function getSession(token?: string): Promise<Session | null> {
  const user = await getUserFromToken(token);
  if (!user || !token) return null;
  const claims = verifyToken(token);
  if (!claims) return null;
  return { token, user, expiresAt: claims.exp * 1000 };
}

export function signOut(_token?: string) {}
