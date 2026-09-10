import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? 'freshcart';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'freshcart-api', timestamp: new Date().toISOString() });
});

app.get('/api/config', (_req, res) => {
  res.json({ databaseConfigured: Boolean(mongoUri), environment: process.env.NODE_ENV ?? 'development' });
});

app.get('/api/products', async (_req, res) => {
  if (!mongoUri) {
    return res.json({ source: 'demo', products: [] });
  }

  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const products = await client.db(dbName).collection('products').find({ status: { $ne: 'archived' } }).limit(100).toArray();
    return res.json({ source: 'mongodb', products });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to read products' });
  } finally {
    await client.close();
  }
});

app.post('/api/orders', async (req, res) => {
  const { customerId, shopId, items, address, deliverySlot, paymentMethod } = req.body ?? {};
  if (!customerId || !shopId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'customerId, shopId and at least one item are required' });
  }

  const order = {
    customerId,
    shopId,
    items,
    address: address ?? null,
    deliverySlot: deliverySlot ?? null,
    paymentMethod: paymentMethod ?? 'COD',
    status: 'PLACED',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  if (!mongoUri) {
    return res.status(201).json({ source: 'demo', order: { id: `FC-${Date.now()}`, ...order } });
  }

  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const result = await client.db(dbName).collection('orders').insertOne(order);
    return res.status(201).json({ source: 'mongodb', order: { id: result.insertedId, ...order } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to create order' });
  } finally {
    await client.close();
  }
});

app.listen(port, () => console.log(`FreshCart API listening on http://localhost:${port}`));
