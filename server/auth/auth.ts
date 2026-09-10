import type { Role, User } from '../models/domain.ts';
import { users } from '../store/memoryStore.ts';
import { findUser, findUserById } from '../db/repositories.ts';
import { signToken, verifyToken } from './jwt.ts';
import { verifyPassword } from './password.ts';

export interface Session { token: string; user: User; expiresAt: number; }

const loginRoles: Role[] = ['customer', 'shopkeeper', 'employee', 'store_manager', 'admin', 'super_admin'];

export async function signIn(identifier: string, password?: string): Promise<Session | null> {
  const normalized = identifier.trim().toLowerCase();
  const matches = await Promise.all(loginRoles.map(role => findUser(normalized, role)));
  let user = matches.find(Boolean) as User | null;
  if (!user) {
    user = users.find(u => u.active && (u.email.toLowerCase() === normalized || u.phone === identifier.trim())) ?? null;
  }
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
  const dbUser = await findUserById(claims.sub);
  if (dbUser && dbUser.role === claims.role) return { ...dbUser, passwordHash: undefined };
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
