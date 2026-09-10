import crypto from 'node:crypto';
import type { User } from '../models/domain';

function secret() {
  const value = process.env.JWT_SECRET?.trim();
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set to at least 32 characters in production');
    return 'development-only-change-me-development-secret-32';
  }
  return value;
}

const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');

export function signToken(user: User) {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64(JSON.stringify({ sub: user.id, role: user.role, shopId: user.shopId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 }));
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyToken(token: string) {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    const expected = crypto.createHmac('sha256', secret()).update(`${header}.${payload}`).digest('base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data?.exp === undefined || data.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof data.sub !== 'string' || typeof data.role !== 'string') return null;
    return data as { sub: string; role: User['role']; shopId?: string; exp: number };
  } catch {
    return null;
  }
}
