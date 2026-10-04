-- =====================================================================
-- TEST / MOCK ONLY. Mimics the parts of Supabase that schema.sql relies on,
-- so schema.sql can run unchanged in PGlite (no Docker, no live project).
-- Never run this against a real Supabase project.
-- =====================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Supabase reads the signed-in user from the JWT. Tests set request.jwt.claim.sub.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant select on auth.users to anon, authenticated;

create publication supabase_realtime;
