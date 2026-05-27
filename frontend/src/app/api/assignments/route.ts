import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin, serializeAssignment } from '@/lib/supabase';
import { generateQuestionPaper } from '@/lib/ai';

// Vercel Hobby allows up to 60 seconds; this leaves plenty of room for Groq
// (typically 1–5s) plus the waitUntil background step.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const QuestionTypeRequestSchema = z.object({
  type:  z.enum(['mcq', 'short', 'long', 'truefalse', 'fill', 'numerical']),
  count: z.number().int().min(1).max(50),
  marks: z.number().int().min(1).max(100),
});

const CreateAssignmentSchema = z.object({
  title:    z.string().min(1).max(200),
  subject:  z.string().min(1).max(80),
  grade:    z.string().min(1).max(30),
  dueDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be yyyy-mm-dd'),
  questionTypes:          z.array(QuestionTypeRequestSchema).min(1),
  additionalInstructions: z.string().max(2000).optional().default(''),
  sourceText:             z.string().max(50000).optional().default(''),
  sourceFilename:         z.string().max(255).optional().default(''),
});

/**
 * POST /api/assignments
 * Creates an assignment row, returns immediately with status='queued',
 * and runs the AI generation in the background via Vercel's waitUntil.
 * The /generating/[jobId] page polls until status flips to completed/failed.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreateAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Reject past due dates explicitly — same rule as the Express controller.
  if (new Date(parsed.data.dueDate) < new Date(new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ ok: false, error: 'dueDate cannot be in the past' }, { status: 400 });
  }

  const { data: row, error } = await supabaseAdmin
    .from('assignments')
    .insert({ inputs: parsed.data, status: 'queued' })
    .select()
    .single();

  if (error || !row) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'Failed to create assignment' },
      { status: 500 },
    );
  }

  // Kick off generation in the background. waitUntil keeps the function alive
  // past the response so we can finish the work — no separate worker needed.
  const work = processGeneration(row.id, parsed.data);
  try {
    const { waitUntil } = await import('@vercel/functions');
    waitUntil(work);
  } catch {
    // Local dev / non-Vercel: just fire-and-forget. The polling on the
    // frontend still picks the result up when it lands.
    void work;
  }

  return NextResponse.json(
    {
      ok: true,
      assignmentId: row.id,
      jobId: row.id,
      wsTopic: `job:${row.id}`,
      status: 'queued',
    },
    { status: 202 },
  );
}

/** GET /api/assignments — list newest first */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    assignments: (data ?? []).map(serializeAssignment),
  });
}

/** Internal: run the AI call, update the row when done (or on failure). */
async function processGeneration(id: string, input: z.infer<typeof CreateAssignmentSchema>) {
  const start = Date.now();
  try {
    await supabaseAdmin.from('assignments').update({ status: 'active' }).eq('id', id);
    const paper = await generateQuestionPaper(input);
    await supabaseAdmin
      .from('assignments')
      .update({ status: 'completed', paper, generation_ms: Date.now() - start })
      .eq('id', id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from('assignments')
      .update({ status: 'failed', error: msg })
      .eq('id', id);
  }
}
