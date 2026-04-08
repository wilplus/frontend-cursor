-- ============================================================================
-- Rename legacy warm-up task tables → public.tasks / public.tasks_pool
-- ============================================================================
-- Idempotent: skips if target names already exist or legacy names are absent.
--
-- Legacy (before):
--   public.v2_warm_up_tasks
--   public.v2_warm_up_task_pool
--
-- After:
--   public.tasks
--   public.tasks_pool
--
-- IMPORTANT:
-- - Backend canonical migration (Flask repo): `migrations/rename_warmup_to_tasks_and_drop_focus.sql`
--   — same idempotent rename rules, plus FKs (e.g. session_task_id, assigned_task_id),
--   GRANTs, and pairing with `enable_rls_public_tables.sql`. If that migration
--   already ran in an environment, this file is a safe no-op (targets already exist).
-- - If only `v2_warm_up_*` exists and you use backend-first deploy, prefer the backend
--   bundle above; this script is for DBs managed from this repo or emergency rename-only.
-- - This repo's Next BFF + adminApi accept JSON keys `tasks` / `tasks_pool` and legacy
--   `task_warm_up` / `task_warm_up_pool` (see `src/lib/api/admin-client.ts`).
-- - On RENAME-only (this file): PostgreSQL updates dependent FK names; RLS/GRANT changes
--   may still need the backend migrations.
--
-- Rollback (manual, only if no data depends on new names yet):
--   ALTER TABLE IF EXISTS public.tasks_pool RENAME TO v2_warm_up_task_pool;
--   ALTER TABLE IF EXISTS public.tasks RENAME TO v2_warm_up_tasks;
--
-- Suggested order with other migrations in this repo:
--   1) Apply any migration that creates v2_warm_up_* (your baseline schema).
--   2) docs/migrations/add_max_performance_score.sql (supports both names).
--   3) This file (rename).
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.tasks_pool') IS NULL AND to_regclass('public.v2_warm_up_task_pool') IS NOT NULL THEN
    ALTER TABLE public.v2_warm_up_task_pool RENAME TO tasks_pool;
  END IF;

  IF to_regclass('public.tasks') IS NULL AND to_regclass('public.v2_warm_up_tasks') IS NOT NULL THEN
    ALTER TABLE public.v2_warm_up_tasks RENAME TO tasks;
  END IF;
END $$;

COMMENT ON TABLE public.tasks IS
  'Per-student tasks (formerly v2_warm_up_tasks).';

COMMENT ON TABLE public.tasks_pool IS
  'Global task pool (formerly v2_warm_up_task_pool).';

NOTIFY pgrst, 'reload schema';
