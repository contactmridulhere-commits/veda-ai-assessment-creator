import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, serializeAssignment } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * In the Vercel deployment we don't have a separate BullMQ jobId — the
 * assignment row's primary key is the job id. The endpoint still exists
 * so the frontend's polling hook works unchanged across both deployments
 * (Express+BullMQ and Vercel+Supabase).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'Assignment not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, assignment: serializeAssignment(data) });
}
