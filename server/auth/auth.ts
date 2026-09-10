import type { Role, User } from '../models/domain';
import { users } from '../store/memoryStore';
import { signToken, verifyToken } from './jwt';

export interface Session { token: string; user: User; expiresAt: number; }

export function signIn(identifier: string, role: Role): Session | null {
  const normalized = identifier.trim().toLowerCase();
  const user = users.find(
    u => u.active && (u.email.toLowerCase() === normalized || u.phone === identifier.trim()) && u.role === role,
  );
  if (!user) return null;
  const token = signToken(user);
  return { token, user, expiresAt: Date.now() + 1000 * 60 * 60 * 12 };
}

export function getUserFromToken(token?: string) {
  if (!token) return null;
  const claims = verifyToken(token);
  if (!claims) return null;
  return users.find(u => u.active && u.id === claims.sub && u.role === claims.role) ?? null;
}

export function getSession(token?: string): Session | null {
  const user = getUserFromToken(token);
  if (!user || !token) return null;
  const claims = verifyToken(token);
  if (!claims) return null;
  return { token, user, expiresAt: claims.exp * 1000 };
}

export function signOut(_token?: string) {
  // JWT access tokens are stateless; clients discard the token on logout.
}
