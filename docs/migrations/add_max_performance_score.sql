-- ============================================================================
-- Add missing column: max_performance_score
-- ============================================================================
-- Error seen: "Could not find the 'max_performance_score' column of
-- 'v2_warm_up_tasks' in the schema cache" (PGRST204 → 503).
-- The table existed but was created before this column was added.
--
-- Run this in Supabase SQL Editor (or your Postgres client) against the
-- same DB your backend uses.
-- ============================================================================

-- Warm-up tasks (per-student)
ALTER TABLE v2_warm_up_tasks
ADD COLUMN IF NOT EXISTS max_performance_score INTEGER DEFAULT 10;

-- Focus tasks (per-student) — add if your v2_focus_tasks was created without it
ALTER TABLE v2_focus_tasks
ADD COLUMN IF NOT EXISTS max_performance_score INTEGER DEFAULT 10;

-- Optional: add to pool tables if they exist and are missing the column
ALTER TABLE v2_warm_up_task_pool
ADD COLUMN IF NOT EXISTS max_performance_score INTEGER DEFAULT 10;

ALTER TABLE v2_focus_task_pool
ADD COLUMN IF NOT EXISTS max_performance_score INTEGER DEFAULT 10;

-- Main task table (if your app uses it and the column is missing)
ALTER TABLE v2_tasks
ADD COLUMN IF NOT EXISTS max_performance_score DECIMAL(3,2) DEFAULT 1.00
CHECK (max_performance_score >= 0 AND max_performance_score <= 1);

-- Reload PostgREST schema cache so it sees the new column
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verify (run separately if you want to check):
-- ============================================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'v2_warm_up_tasks'
--   AND column_name = 'max_performance_score';
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'v2_focus_tasks'
-- ORDER BY ordinal_position;
--
-- For v2_tasks:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'v2_tasks'
--   AND column_name = 'max_performance_score';
-- ============================================================================
