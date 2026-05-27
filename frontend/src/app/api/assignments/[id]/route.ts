import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, serializeAssignment } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'Assignment not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, assignment: serializeAssignment(data) });
}
