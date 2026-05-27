import { Worker, type Job } from 'bullmq';
import 'dotenv/config';
import { GENERATE_QUEUE, type GenerateJobData } from './generate.queue.js';
import { redisConnection, cache, buildCacheKey } from './connection.js';
import { connectMongo } from '../config/db.js';
import { Assignment } from '../models/Assignment.js';
import { generateQuestionPaper } from '../services/ai.service.js';
import { publish } from '../ws/socket.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { STAGES, type JobStatusValue, type JobUpdate, type QuestionPaper } from '../types/domain.js';

/**
 * Worker entrypoint. Run with: `npm run worker`
 *
 * Pipeline:
 *   1. Mark Mongo doc as active + announce 'queued → active' over WS.
 *   2. Walk through the early "warm-up" stages with small visible delays so
 *      the frontend progress indicator feels responsive even when the
 *      underlying AI call is fast (Groq on GPT-OSS-20B can return in ~1.5s).
 *   3. Check Redis cache by deterministic input hash; identical re-submits
 *      reuse a previous paper instantly.
 *   4. On cache miss, call the AI service (Groq → openai/gpt-oss-20b).
 *   5. Persist the paper to Mongo (and into paperHistory on regenerate).
 *   6. Publish 'completed' with the paper payload — the frontend renders
 *      that directly, never the raw LLM string.
 */

function emit(
  jobId: string,
  assignmentId: string,
  status: JobStatusValue,
  stageIdx: number,
  extra: Partial<JobUpdate> = {},
): JobUpdate {
  const stage = STAGES[stageIdx];
  const update: JobUpdate = {
    jobId,
    assignmentId,
    status,
    stage: stage?.key,
    stageLabel: stage?.label,
    progress: stageIdx >= 0 ? Math.min(1, (stageIdx + 1) / STAGES.length) : 0,
    ts: new Date().toISOString(),
    ...extra,
  };
  publish(jobId, update);
  return update;
}

async function processJob(job: Job<GenerateJobData>): Promise<{ paper: QuestionPaper }> {
  const { jobId, assignmentId, input } = job.data;
  const t0 = Date.now();
  logger.info({ jobId }, '▶ processing job');

  await Assignment.updateOne({ _id: assignmentId }, { $set: { status: 'active' } });

  // Warm-up stages — small UX delay so the user sees the progress steps tick.
  for (let i = 0; i < 3; i++) {
    emit(jobId, assignmentId, 'active', i);
    await new Promise(r => setTimeout(r, 250));
  }

  // Cache check
  const cacheKey = buildCacheKey(input);
  let paper: QuestionPaper | null = null;
  try {
    const cached = await cache.get(cacheKey);
    if (cached) {
      paper = JSON.parse(cached) as QuestionPaper;
      logger.info({ jobId, cacheKey }, '✓ cache hit — skipping AI call');
    }
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'cache read failed');
  }

  // AI call
  if (!paper) {
    emit(jobId, assignmentId, 'active', 3); // "Drafting questions"
    paper = await generateQuestionPaper(input);
    try {
      await cache.setex(cacheKey, env.PAPER_CACHE_TTL, JSON.stringify(paper));
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'cache write failed');
    }
  }

  // Late stages
  emit(jobId, assignmentId, 'active', 4); // balance
  emit(jobId, assignmentId, 'active', 5); // organise
  emit(jobId, assignmentId, 'active', 6); // finalise

  // Persist
  const existing = await Assignment.findById(assignmentId);
  if (existing && existing.paper) {
    existing.paperHistory = [...(existing.paperHistory ?? []), existing.paper];
  }
  await Assignment.updateOne(
    { _id: assignmentId },
    {
      $set: {
        status: 'completed',
        paper,
        paperHistory: existing?.paperHistory ?? [],
        generationMs: Date.now() - t0,
      },
    },
  );

  emit(jobId, assignmentId, 'completed', STAGES.length - 1, { paper, progress: 1 });
  logger.info({ jobId, ms: Date.now() - t0 }, '✓ job completed');
  return { paper };
}

async function main() {
  await connectMongo();

  const worker = new Worker<GenerateJobData>(
    GENERATE_QUEUE,
    processJob,
    {
      connection: redisConnection,
      concurrency: 4,
      lockDuration: 60_000,
    },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.data.jobId }, 'worker: completed'));
  worker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.data.jobId, err: err.message }, 'worker: failed');
    if (job?.data.assignmentId) {
      await Assignment.updateOne(
        { _id: job.data.assignmentId },
        { $set: { status: 'failed', error: err.message } },
      );
      emit(job.data.jobId, job.data.assignmentId, 'failed', 0, { error: err.message, progress: 0 });
    }
  });

  logger.info({ model: env.GROQ_MODEL }, '✓ Generate worker ready');
}

main().catch((err) => {
  logger.fatal({ err }, 'worker boot failed');
  process.exit(1);
});
