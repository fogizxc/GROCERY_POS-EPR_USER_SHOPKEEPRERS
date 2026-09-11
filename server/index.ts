import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { api } from './routes/api.ts';
import { auth } from './routes/auth.ts';
import { bootstrap } from './routes/bootstrap.ts';
import { customer } from './routes/customer.ts';
import { admin } from './routes/admin.ts';
import { shopkeeper } from './routes/shopkeeper.ts';
import { shopkeeperPortal } from './routes/shopkeeperPortal.ts';
import { delivery } from './routes/delivery.ts';
import { ops } from './routes/ops.ts';
import { paymentsRouter, paymentWebhook } from './routes/payments.ts';
import { onboarding } from './routes/onboarding.ts';
import { pickup } from './routes/pickup.ts';
import { connectMongo, closeMongo, mongoDb } from './db/mongodb.ts';
import { rateLimit } from './middleware/rateLimit.ts';

export const app = express();
const port = Number(process.env.PORT ?? 4000);
const isProduction = process.env.NODE_ENV === 'production';
const clientOrigin = process.env.CLIENT_ORIGIN;

app.disable('x-powered-by');
app.set('trust proxy', 1);
const allowedOrigins = clientOrigin?.split(',').map(origin => origin.trim()).filter(Boolean) ?? [];
app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')); }, credentials: true }));
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); next(); });
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentWebhook);
app.use(express.json({ limit: '2mb' }));
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'freshcart-api' }));
app.get('/api', (_req, res) => res.status(200).json({ ok: true, service: 'freshcart-api', message: 'API is running' }));
app.get('/ready', (_req, res) => { const ready = Boolean(mongoDb()); return res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', database: ready ? 'connected' : 'disconnected' }); });
app.get('/api/config', (_req, res) => res.json({ databaseConfigured: Boolean(process.env.MONGODB_URI), environment: process.env.NODE_ENV ?? 'development' }));

app.use(async (_req, _res, next) => {
  if (!process.env.VERCEL || mongoDb()) return next();
  try { await connectMongo(); } catch (error) { console.error('MongoDB request initialization failed:', error); }
  next();
});

app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 240 }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), auth);
app.use('/api/onboarding', rateLimit({ windowMs: 15 * 60 * 1000, max: 12 }), onboarding);
app.use('/api/shopkeeper-portal', rateLimit({ windowMs: 60 * 1000, max: 120 }), shopkeeperPortal);
app.use('/api', api);
app.use('/api/bootstrap', bootstrap);
app.use('/api/customer', customer);
app.use('/api/admin', admin);
app.use('/api/shopkeeper', shopkeeper);
app.use('/api/delivery', delivery);
app.use('/api/ops', ops);
app.use('/api/payments', paymentsRouter);
app.use('/api/pickup', pickup);

const frontendDist = path.resolve(process.cwd(), 'dist');
app.use(express.static(frontendDist, { index: 'index.html', maxAge: isProduction ? '1d' : 0 }));
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => res.sendFile(path.join(frontendDist, 'index.html'), error => error && next(error)));
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((error: unknown, _req, res, _next: express.NextFunction) => { console.error(error); res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' }); });

async function start() {
  if (isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) throw new Error('JWT_SECRET with at least 32 characters is required in production');
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in production');
    if (!process.env.CLIENT_ORIGIN) throw new Error('CLIENT_ORIGIN is required in production');
  }
  try { const db = await connectMongo(); if (db) console.log(`FreshCart MongoDB connected: ${db.databaseName}`); else if (isProduction) throw new Error('MongoDB did not initialize in production'); }
  catch (error) { console.error('MongoDB connection failed:', error); if (isProduction) throw error; }
  const server = app.listen(port, () => console.log(`FreshCart API listening on port ${port}`));
  const shutdown = async () => { server.close(async () => { await closeMongo(); process.exit(0); }); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
if (!process.env.VERCEL) void start();
