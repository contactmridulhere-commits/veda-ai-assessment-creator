-- VedaAI · Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query)

create extension if not exists "pgcrypto";

create table if not exists assignments (
  id              uuid primary key default gen_random_uuid(),
  inputs          jsonb not null,
  paper           jsonb,
  paper_history   jsonb not null default '[]'::jsonb,
  status          text not null default 'queued'
                  check (status in ('queued','active','completed','failed')),
  error           text default '',
  generation_ms   int default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists assignments_created_at_idx
  on assignments (created_at desc);

-- Auto-update updated_at on row change
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists assignments_updated_at on assignments;
create trigger assignments_updated_at
  before update on assignments
  for each row execute function set_updated_at();

-- For a public demo: disable RLS (service role key bypasses it anyway,
-- and anon key is never used directly from the client in this app).
alter table assignments disable row level security;
