import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { api } from './routes/api';
import { auth } from './routes/auth';
import { bootstrap } from './routes/bootstrap';
import { admin } from './routes/admin';
import { shopkeeper } from './routes/shopkeeper';
import { connectMongo, closeMongo, mongoDb } from './db/mongodb';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN;

app.disable('x-powered-by');
app.use(cors({ origin: clientOrigin ? clientOrigin.split(',').map(origin => origin.trim()) : true, credentials: true }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));

app.get('/api/config', (_req, res) => {
  res.json({ databaseConfigured: Boolean(process.env.MONGODB_URI), environment: process.env.NODE_ENV ?? 'development' });
});
app.use('/api/auth', auth);
app.use('/api/bootstrap', bootstrap);
app.use('/api', api);
app.use('/api/admin', admin);
app.use('/api/shopkeeper', shopkeeper);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET is required in production');
  try {
    const db = await connectMongo();
    if (db) console.log(`FreshCart MongoDB connected: ${db.databaseName}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    if (process.env.NODE_ENV === 'production') throw error;
  }

  const server = app.listen(port, () => console.log(`FreshCart API listening on http://localhost:${port}`));
  const shutdown = async () => {
    server.close(async () => {
      await closeMongo();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void start();
