import express from 'express';
import cors from 'cors';
import { api } from './routes/api';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', api);
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 4000);
  createApp().listen(port, () => console.log(`FreshCart API running on http://localhost:${port}`));
}
