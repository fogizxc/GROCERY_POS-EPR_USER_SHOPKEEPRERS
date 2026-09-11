import type { Role, User } from '../models/domain.ts';
import { users } from '../store/memoryStore.ts';
import { findUser, findUserById } from '../db/repositories.ts';
import { signToken, verifyToken } from './jwt.ts';
import { hashPassword, verifyPassword } from './password.ts';

export interface Session { token: string; user: User; expiresAt: number; }

const loginRoles: Role[] = ['customer', 'shopkeeper', 'employee', 'store_manager', 'admin', 'super_admin'];

function configuredOwnerAccount(): User | null {
  const identifier = (process.env.SUPER_ADMIN_LOGIN_ID || process.env.ADMIN_LOGIN_ID || '').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_LOGIN_PASSWORD || process.env.ADMIN_LOGIN_PASSWORD || '';
  if (!identifier || !password) return null;

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  return {
    id: 'super-admin-owner',
    name: 'FreshCart Super Admin',
    email: looksLikeEmail ? identifier : 'superadmin@freshcart.in',
    phone: looksLikeEmail ? (process.env.SUPER_ADMIN_LOGIN_PHONE || process.env.ADMIN_LOGIN_PHONE || '9999999999') : identifier,
    username: looksLikeEmail ? undefined : identifier,
    role: 'super_admin',
    active: true,
    passwordHash: hashPassword(password),
  };
}

export async function signIn(identifier: string, password?: string): Promise<Session | null> {
  const normalized = identifier.trim().toLowerCase();
  const matches = await Promise.all(loginRoles.map(role => findUser(normalized, role)));
  let user = matches.find(Boolean) as User | null;
  if (!user) user = users.find(u => u.active && (u.email.toLowerCase() === normalized || u.phone === identifier.trim() || (u.username?.toLowerCase() === normalized))) ?? null;

  // Owner credentials are also accepted directly from the server environment.
  // This makes the dedicated super-admin login resilient if MongoDB has not yet
  // been initialized on a serverless instance; the normal DB account remains the
  // source of truth whenever it exists.
  if (!user) {
    const owner = configuredOwnerAccount();
    if (owner && (owner.email === normalized || owner.phone === identifier.trim() || owner.username === normalized)) {
      if (!password || !verifyPassword(password, owner.passwordHash!)) return null;
      user = owner;
    }
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
  if (user) return { ...user, passwordHash: undefined };

  const owner = configuredOwnerAccount();
  if (owner && owner.id === claims.sub && claims.role === 'super_admin') return { ...owner, passwordHash: undefined };
  return null;
}

export async function getSession(token?: string): Promise<Session | null> {
  const user = await getUserFromToken(token);
  if (!user || !token) return null;
  const claims = verifyToken(token);
  if (!claims) return null;
  return { token, user, expiresAt: claims.exp * 1000 };
}

export function signOut(_token?: string) {}
