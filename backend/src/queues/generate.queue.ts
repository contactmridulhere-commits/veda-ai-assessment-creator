import { Queue, type JobsOptions } from 'bullmq';
import { redisConnection } from './connection.js';
import type { CreateAssignmentInput } from '../types/domain.js';

export const GENERATE_QUEUE = 'generate-paper';

export interface GenerateJobData {
  jobId: string;
  assignmentId: string; // Mongo _id
  input: CreateAssignmentInput;
}

export const generateQueue = new Queue<GenerateJobData>(GENERATE_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 4000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail:     { age: 7 * 24 * 3600 },
  } satisfies JobsOptions,
});
