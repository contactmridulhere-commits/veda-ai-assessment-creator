import { z } from 'zod';
import type { CreateAssignmentInput, QuestionPaper, QuestionType } from './types';

/**
 * Self-contained AI module for the Vercel deployment.
 *
 * Equivalent to the backend's services/{ai,prompt,parser} trio, but bundled
 * into one file so the Next.js API route can call `generateQuestionPaper`
 * directly without a separate server. Groq's OpenAI-compatible REST API
 * means no SDK is needed — fetch alone keeps the bundle tiny.
 */

const GROQ_BASE = process.env.GROQ_BASE_URL?.replace(/\/$/, '') ?? 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b';
const AI_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS ?? 4000);
const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? 0.4);

// ─── Prompt ───────────────────────────────────────────────────────────────

const QT_LABEL: Record<QuestionType, string> = {
  mcq:       'Multiple Choice Questions',
  short:     'Short Answer Questions',
  long:      'Long Answer Questions',
  truefalse: 'True / False Questions',
  fill:      'Fill in the Blanks',
  numerical: 'Numerical Problems',
};

function buildPrompt(input: CreateAssignmentInput): string {
  const totalQs    = input.questionTypes.reduce((s, t) => s + t.count, 0);
  const totalMarks = input.questionTypes.reduce((s, t) => s + t.count * t.marks, 0);

  const sectionPlan = input.questionTypes
    .map((t, i) =>
      `  Section ${String.fromCharCode(65 + i)} — ${QT_LABEL[t.type]}: ${t.count} questions × ${t.marks} mark${t.marks === 1 ? '' : 's'} (= ${t.count * t.marks} marks)`,
    )
    .join('\n');

  const sourceBlock = input.sourceText
    ? `\nReference source material (anchor questions to this content where possible):\n"""\n${input.sourceText.slice(0, 3500)}\n"""`
    : '';

  const extraBlock = input.additionalInstructions?.trim()
    ? `\nTeacher's additional instructions: ${input.additionalInstructions.trim()}`
    : '';

  return `Generate ONE complete question paper as STRICT JSON ONLY — no prose, no markdown code fences.

Paper specification
- Title: "${input.title}"
- Subject: ${input.subject}
- Class / Grade: ${input.grade}
- Due date: ${input.dueDate}
- Total questions: ${totalQs}
- Total marks: ${totalMarks}

Structure (one section per question type, in this exact order):
${sectionPlan}

Rules:
1. Difficulty mix per section: roughly 40% easy, 40% moderate, 20% hard. Tag each question as "easy", "moderate", or "hard".
2. Every MCQ MUST have exactly 4 plausible options as ["(a) …", "(b) …", "(c) …", "(d) …"].
3. True/False statements must be single declarative sentences.
4. Fill-in-the-blank questions must contain a "___" placeholder.
5. Numerical problems must include realistic numbers with units.
6. Questions must be self-contained, original, and grade-appropriate.
${sourceBlock}${extraBlock}

Return EXACTLY this JSON shape (no extra keys, no missing keys):
{
  "title": string, "subject": string, "grade": string, "dueDate": string,
  "totalMarks": number, "timeAllowedMinutes": number,
  "generalInstructions": string[],
  "sections": [
    {
      "id": "A" | "B" | "C" | "...",
      "title": string, "instruction": string,
      "type": "mcq" | "short" | "long" | "truefalse" | "fill" | "numerical",
      "marksPerQuestion": number,
      "questions": [
        {
          "number": number, "text": string,
          "difficulty": "easy" | "moderate" | "hard",
          "marks": number, "options": string[] | null,
          "type": "mcq" | "short" | "long" | "truefalse" | "fill" | "numerical"
        }
      ]
    }
  ]
}`;
}

// ─── Groq call ─────────────────────────────────────────────────────────────

class AIRequestError extends Error {
  constructor(public status: number, public body: string) {
    super(`AI request failed (${status}): ${body.slice(0, 200)}`);
    this.name = 'AIRequestError';
  }
}

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing GROQ_API_KEY env var');

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an experienced exam-paper setter for Indian schools (CBSE-style). ' +
            'You always respond with valid, parseable JSON only — no prose, no markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: AI_TEMPERATURE,
      max_tokens: AI_MAX_TOKENS,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new AIRequestError(res.status, await res.text());

  const data: any = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  if (!content.trim()) throw new AIRequestError(502, 'Empty completion');
  return content;
}

// ─── Parser ────────────────────────────────────────────────────────────────

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

function extractJSON(raw: string): unknown {
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(fenced); } catch { /* fall through */ }
  const first = fenced.indexOf('{');
  const last  = fenced.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(fenced.slice(first, last + 1)); } catch { /* give up */ }
  }
  throw new Error('Response was not valid JSON');
}

function parsePaper(raw: string): QuestionPaper {
  const obj = extractJSON(raw);
  const parsed = PaperSchema.safeParse(obj);
  if (!parsed.success) {
    throw new Error(`Generated paper failed validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }
  // Light post-validation
  for (const sec of parsed.data.sections) {
    for (const q of sec.questions) {
      if (q.type === 'mcq' && (!q.options || q.options.length !== 4)) {
        throw new Error(`MCQ question #${q.number} must have exactly 4 options`);
      }
    }
  }
  return parsed.data;
}

// ─── Public entrypoint ─────────────────────────────────────────────────────

export async function generateQuestionPaper(
  input: CreateAssignmentInput,
): Promise<QuestionPaper> {
  const prompt = buildPrompt(input);
  let raw: string;
  try {
    raw = await callGroq(prompt);
  } catch (err) {
    // One quick retry on 5xx — Groq is very fast but occasionally blips.
    if (err instanceof AIRequestError && err.status >= 500) {
      await new Promise(r => setTimeout(r, 500));
      raw = await callGroq(prompt);
    } else {
      throw err;
    }
  }
  return parsePaper(raw);
}
