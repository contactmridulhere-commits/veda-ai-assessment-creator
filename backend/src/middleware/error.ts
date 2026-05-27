import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  const msg = err instanceof Error ? err.message : 'Unknown error';
  logger.error({ err: msg }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error', message: msg });
}
