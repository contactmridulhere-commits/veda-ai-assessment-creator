import IORedis, { type RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const opts: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  // BullMQ requires maxRetriesPerRequest: null for blocking commands
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

/** Shared connection used by BullMQ workers and queues (must have maxRetriesPerRequest=null). */
export const redisConnection = new IORedis(opts);

/** Separate, application-level Redis client used for caching/key-value. */
export const cache = new IORedis({ ...opts, maxRetriesPerRequest: 3 });

redisConnection.on('connect', () => logger.info('✓ Redis (BullMQ) connected'));
redisConnection.on('error', (e) => logger.error({ err: e.message }, 'Redis (BullMQ) error'));
cache.on('error', (e) => logger.error({ err: e.message }, 'Redis (cache) error'));

/** Build a deterministic cache key from the assignment input so identical
 *  requests reuse a previously generated paper. The model name is included
 *  so changing GROQ_MODEL invalidates entries cleanly. */
export function buildCacheKey(input: {
  title: string;
  subject: string;
  grade: string;
  dueDate: string;
  additionalInstructions?: string;
  sourceText?: string;
  questionTypes: Array<{ type: string; count: number; marks: number }>;
}): string {
  const parts = [
    env.GROQ_MODEL,
    input.title,
    input.subject,
    input.grade,
    input.dueDate,
    input.additionalInstructions || '',
    (input.sourceText || '').slice(0, 500), // first 500 chars is enough to differentiate
    ...input.questionTypes.map(q => `${q.type}:${q.count}x${q.marks}`).sort(),
  ];
  const raw = parts.join('|').toLowerCase().replace(/\s+/g, ' ').trim();
  // FNV-1a-ish digest — small, stable, no extra deps.
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `paper:${(h >>> 0).toString(36)}`;
}
