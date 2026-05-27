import { Router } from 'express';
import mongoose from 'mongoose';
import { redisConnection } from '../queues/connection.js';

const router = Router();

router.get('/', async (_req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  let redis = 'down';
  try { await redisConnection.ping(); redis = 'up'; } catch { /* keep down */ }

  const ok = dbState === 1 && redis === 'up';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    uptime: process.uptime(),
    services: { mongo: dbState === 1 ? 'up' : 'down', redis },
    ts: new Date().toISOString(),
  });
});

export default router;
