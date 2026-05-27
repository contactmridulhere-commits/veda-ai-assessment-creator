import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, serializeAssignment } from '@/lib/supabase';
import { generateQuestionPaper } from '@/lib/ai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/assignments/[id]/regenerate
 * Pushes the current paper into paper_history, resets status, and kicks off
 * a fresh generation with the same inputs.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('assignments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Assignment not found' }, { status: 404 });
  }

  // Archive current paper before clearing it.
  const history = Array.isArray(existing.paper_history) ? existing.paper_history : [];
  const nextHistory = existing.paper ? [...history, existing.paper] : history;

  const { error: updateErr } = await supabaseAdmin
    .from('assignments')
    .update({
      status: 'queued',
      paper: null,
      paper_history: nextHistory,
      error: '',
      generation_ms: 0,
    })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  const work = (async () => {
    const start = Date.now();
    try {
      await supabaseAdmin.from('assignments').update({ status: 'active' }).eq('id', id);
      const paper = await generateQuestionPaper(existing.inputs);
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
  })();

  try {
    const { waitUntil } = await import('@vercel/functions');
    waitUntil(work);
  } catch {
    void work;
  }

  return NextResponse.json(
    {
      ok: true,
      assignmentId: id,
      jobId: id,
      wsTopic: `job:${id}`,
      status: 'queued',
    },
    { status: 202 },
  );
}

/** GET version — return the assignment, same shape as the canonical endpoint. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, assignment: serializeAssignment(data) });
}
