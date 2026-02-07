-- ============================================================================
-- max_performance_score: add column (0..1 scale, NUMERIC(3,2))
-- ============================================================================
-- Admin UI uses 0–1 ("Max score (0–1)" in warm-up/focus modals).
-- Run in the Supabase project your backend uses. Then wait ~10s and retry admin.
--
-- ADD COLUMN IF NOT EXISTS does not change an existing column. If the column
-- already exists with the wrong type (e.g. integer), you must ALTER COLUMN
-- ... TYPE separately (see "If column exists as integer" below).
-- ============================================================================

-- Add columns if missing (no inline CHECK so PostgREST sees the column first)
alter table public.v2_warm_up_tasks
  add column if not exists max_performance_score numeric(3,2) not null default 1.00;

alter table public.v2_focus_tasks
  add column if not exists max_performance_score numeric(3,2) not null default 1.00;

alter table public.v2_warm_up_task_pool
  add column if not exists max_performance_score numeric(3,2) not null default 1.00;

alter table public.v2_focus_task_pool
  add column if not exists max_performance_score numeric(3,2) not null default 1.00;

-- Optional: main task table (if your app uses it)
-- alter table public.v2_tasks
--   add column if not exists max_performance_score numeric(3,2) not null default 1.00;

-- Reload PostgREST schema cache (fixes PGRST204 "schema cache")
notify pgrst, 'reload schema';

-- ============================================================================
-- Diagnostics (run if you still get PGRST204 or 503)
-- ============================================================================
-- 1) Does the column exist, and which DB am I in?
-- select
--   exists (
--     select 1 from information_schema.columns
--     where table_schema = 'public'
--       and table_name = 'v2_warm_up_tasks'
--       and column_name = 'max_performance_score'
--   ) as has_column,
--   (select current_database()) as db;
--
-- 2) What type does the column have? (if integer, ADD COLUMN did nothing)
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'v2_warm_up_tasks'
--   and column_name = 'max_performance_score';
--
-- If has_column = true but API still returns PGRST204 → backend is using a
-- different Supabase project. If data_type = 'integer' → run ALTER COLUMN below.
-- ============================================================================

-- ============================================================================
-- If column already existed as integer (ADD COLUMN IF NOT EXISTS did nothing)
-- ============================================================================
-- alter table public.v2_warm_up_tasks
--   alter column max_performance_score type numeric(3,2)
--     using (case when max_performance_score > 1 then max_performance_score / 10.0 else max_performance_score end),
--   alter column max_performance_score set default 1.00;
-- notify pgrst, 'reload schema';
-- ============================================================================
