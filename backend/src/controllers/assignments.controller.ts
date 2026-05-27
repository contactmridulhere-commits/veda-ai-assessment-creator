import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Assignment } from '../models/Assignment.js';
import { generateQueue } from '../queues/generate.queue.js';
import { HttpError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';

const QuestionTypeRequestSchema = z.object({
  type:  z.enum(['mcq', 'short', 'long', 'truefalse', 'fill', 'numerical']),
  count: z.number().int().min(1).max(50),
  marks: z.number().int().min(1).max(100),
});

export const CreateAssignmentSchema = z.object({
  title:    z.string().min(1, 'Title is required').max(200),
  subject:  z.string().min(1, 'Subject is required').max(80),
  grade:    z.string().min(1, 'Grade is required').max(30),
  dueDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be yyyy-mm-dd'),
  questionTypes: z.array(QuestionTypeRequestSchema).min(1, 'At least one question type is required'),
  additionalInstructions: z.string().max(2000).optional().default(''),
  sourceText: z.string().max(50000).optional().default(''),
  sourceFilename: z.string().max(255).optional().default(''),
});

export type CreateAssignmentBody = z.infer<typeof CreateAssignmentSchema>;

/** POST /api/assignments — create + enqueue generation job */
export async function createAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as CreateAssignmentBody;

    // Cross-field validation: due date must not be in the past.
    if (new Date(body.dueDate) < new Date(new Date().toISOString().slice(0, 10))) {
      throw new HttpError(400, 'dueDate cannot be in the past');
    }

    const doc = await Assignment.create({
      jobId: cryptoRandom(),
      status: 'queued',
      inputs: body,
    });

    await generateQueue.add(
      'generate-paper',
      { assignmentId: doc.id, jobId: doc.jobId, input: body },
      { jobId: doc.jobId, removeOnComplete: 100, removeOnFail: 500 },
    );

    logger.info({ jobId: doc.jobId, assignmentId: doc.id }, 'Assignment created + queued');
    res.status(202).json({
      ok: true,
      assignmentId: doc.id,
      jobId: doc.jobId,
      wsTopic: `job:${doc.jobId}`,
      status: 'queued',
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/assignments — list */
export async function listAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const docs = await Assignment.find({}, null, { limit, sort: { createdAt: -1 } });
    res.json({ ok: true, count: docs.length, assignments: docs.map(serialize) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/assignments/:id */
export async function getAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await Assignment.findById(req.params.id);
    if (!doc) throw new HttpError(404, 'Assignment not found');
    res.json({ ok: true, assignment: serialize(doc) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/assignments/by-job/:jobId */
export async function getByJobId(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await Assignment.findOne({ jobId: req.params.jobId });
    if (!doc) throw new HttpError(404, 'Assignment not found');
    res.json({ ok: true, assignment: serialize(doc) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/assignments/:id/regenerate — re-enqueue with same inputs */
export async function regenerate(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await Assignment.findById(req.params.id);
    if (!doc) throw new HttpError(404, 'Assignment not found');

    if (doc.paper) {
      doc.paperHistory = [...(doc.paperHistory ?? []), doc.paper];
      doc.paper = null;
    }
    doc.status = 'queued';
    doc.jobId  = cryptoRandom();
    doc.error  = '';
    await doc.save();

    await generateQueue.add(
      'generate-paper',
      { assignmentId: doc.id, jobId: doc.jobId, input: doc.inputs },
      { jobId: doc.jobId, removeOnComplete: 100, removeOnFail: 500 },
    );

    res.status(202).json({
      ok: true,
      assignmentId: doc.id,
      jobId: doc.jobId,
      wsTopic: `job:${doc.jobId}`,
      status: 'queued',
    });
  } catch (err) {
    next(err);
  }
}

function serialize(doc: any) {
  const o = doc.toObject({ virtuals: false });
  return {
    id: String(o._id),
    jobId: o.jobId,
    status: o.status,
    inputs: o.inputs,
    paper: o.paper,
    error: o.error,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// Tiny URL-safe random id — avoids pulling in uuid for one call site.
function cryptoRandom(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomBytes } = require('crypto') as typeof import('crypto');
  return randomBytes(9).toString('base64url');
}
