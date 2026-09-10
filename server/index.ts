import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { api } from './routes/api';
import { auth } from './routes/auth';
import { bootstrap } from './routes/bootstrap';
import { customer } from './routes/customer';
import { admin } from './routes/admin';
import { shopkeeper } from './routes/shopkeeper';
import { delivery } from './routes/delivery';
import { ops } from './routes/ops';
import { paymentsRouter, paymentWebhook } from './routes/payments';
import { connectMongo, closeMongo } from './db/mongodb';
import { rateLimit } from './middleware/rateLimit';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: clientOrigin ? clientOrigin.split(',').map(origin => origin.trim()) : true, credentials: true }));
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); next(); });
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentWebhook);
app.use(express.json({ limit: '1mb' }));
app.get('/api/config', (_req, res) => res.json({ databaseConfigured: Boolean(process.env.MONGODB_URI), environment: process.env.NODE_ENV ?? 'development' }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 240 }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }), auth);
app.use('/api', api);
app.use('/api/bootstrap', bootstrap);
app.use('/api/customer', customer);
app.use('/api/admin', admin);
app.use('/api/shopkeeper', shopkeeper);
app.use('/api/delivery', delivery);
app.use('/api/ops', ops);
app.use('/api/payments', paymentsRouter);
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(error); res.status(500).json({ error: 'Internal server error' }); });

async function start() {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32)) throw new Error('JWT_SECRET with at least 32 characters is required in production');
  try { const db = await connectMongo(); if (db) console.log(`FreshCart MongoDB connected: ${db.databaseName}`); } catch (error) { console.error('MongoDB connection failed:', error); if (process.env.NODE_ENV === 'production') throw error; }
  const server = app.listen(port, () => console.log(`FreshCart API listening on port ${port}`));
  const shutdown = async () => { server.close(async () => { await closeMongo(); process.exit(0); }); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
void start();
