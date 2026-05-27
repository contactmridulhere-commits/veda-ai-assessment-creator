import { z } from 'zod';
import type { QuestionPaper } from '../types/domain.js';
import { logger } from '../utils/logger.js';

const QuestionTypeEnum = z.enum(['mcq', 'short', 'long', 'truefalse', 'fill', 'numerical']);
const DifficultyEnum   = z.enum(['easy', 'moderate', 'hard']);

const QuestionSchema = z.object({
  number: z.number().int().positive(),
  text: z.string().min(1),
  type: QuestionTypeEnum,
  options: z.array(z.string()).nullable().optional(),
  difficulty: DifficultyEnum,
  marks: z.number().positive(),
});

const SectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  instruction: z.string(),
  type: QuestionTypeEnum,
  marksPerQuestion: z.number().positive(),
  questions: z.array(QuestionSchema).min(1),
});

const PaperSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  grade: z.string().min(1),
  dueDate: z.string().min(1),
  totalMarks: z.number().positive(),
  timeAllowedMinutes: z.number().positive(),
  generalInstructions: z.array(z.string()).default([]),
  sections: z.array(SectionSchema).min(1),
});

/**
 * Robustly extract a JSON object from an LLM response that might include
 * stray markdown fences, leading prose, or trailing commentary. We never
 * trust the LLM's wrapper text — only the parsed-and-validated JSON.
 */
function extractJSON(raw: string): unknown {
  const trimmed = raw.trim();

  // Direct parse first — happens when the model honours JSON mode.
  try { return JSON.parse(trimmed); } catch { /* fall through */ }

  // Strip ```json fences if present.
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(fenced); } catch { /* fall through */ }

  // Last resort: find the outermost {...}.
  const first = fenced.indexOf('{');
  const last  = fenced.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const slice = fenced.slice(first, last + 1);
    try { return JSON.parse(slice); } catch { /* give up */ }
  }
  throw new Error('Response was not valid JSON');
}

function postValidate(paper: QuestionPaper): void {
  for (const sec of paper.sections) {
    for (const q of sec.questions) {
      if (q.type === 'mcq') {
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          throw new Error(`MCQ question #${q.number} must have exactly 4 options`);
        }
      }
      if (q.type === 'fill' && !q.text.includes('___')) {
        // Don't throw — just warn. Some teachers accept blanks without underscores.
        logger.warn({ qNumber: q.number }, 'Fill-in-the-blank lacks "___" placeholder');
      }
    }
  }
}

export function parsePaper(raw: string): QuestionPaper {
  const obj = extractJSON(raw);
  const parsed = PaperSchema.safeParse(obj);
  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues.slice(0, 5) }, 'Paper schema validation failed');
    throw new Error(`Generated paper failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }
  postValidate(parsed.data);
  return parsed.data;
}
