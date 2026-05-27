import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client.
 *
 * We use the **service role key** (not the anon key) because all DB writes
 * happen in API routes — never from the browser. The service role key must
 * never be exposed to the client; that's why it's `SUPABASE_SERVICE_ROLE_KEY`
 * (no `NEXT_PUBLIC_` prefix) and only imported by `route.ts` files.
 */

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  // Fail loud during build / first request so misconfiguration is obvious.
  throw new Error(
    'Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  );
}

export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Serialise a DB row into the shape the frontend expects. */
export function serializeAssignment(row: any) {
  return {
    id: row.id,
    jobId: row.id, // We don't use BullMQ on Vercel; reuse the id as job id.
    status: row.status,
    inputs: row.inputs,
    paper: row.paper ?? null,
    error: row.error ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
