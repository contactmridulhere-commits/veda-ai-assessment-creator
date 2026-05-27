import 'dotenv/config';
import { z } from 'zod';

/**
 * Strict env validation. The server should refuse to boot with bad config —
 * silent fallbacks make production debugging miserable.
 */
const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  MONGODB_URI: z.string().min(1),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  GROQ_API_KEY: z.string().min(1, 'Set GROQ_API_KEY — get a free one at console.groq.com'),
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  AI_MAX_TOKENS: z.coerce.number().default(4000),
  AI_TEMPERATURE: z.coerce.number().default(0.4),

  WS_PATH: z.string().default('/ws'),
  PAPER_CACHE_TTL: z.coerce.number().default(86400),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
