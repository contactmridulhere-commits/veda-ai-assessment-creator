import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'node:http';

import { env } from './config/env.js';
import { connectMongo } from './config/db.js';
import { initWebSocket } from './ws/socket.js';
import { errorHandler, notFound } from './middleware/error.js';
import assignmentsRouter from './routes/assignments.routes.js';
import healthRouter from './routes/health.routes.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  await connectMongo();

  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use('/api/health', healthRouter);
  app.use('/api/assignments', assignmentsRouter);

  app.use(notFound);
  app.use(errorHandler);

  const server = createServer(app);
  initWebSocket(server);

  server.listen(env.PORT, () => {
    logger.info(`✓ HTTP server listening on http://localhost:${env.PORT}`);
    logger.info(`✓ WebSocket listening on ws://localhost:${env.PORT}${env.WS_PATH}`);
  });

  // Graceful shutdown
  const shutdown = async (sig: string) => {
    logger.info(`${sig} received — shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'bootstrap failed');
  process.exit(1);
});
