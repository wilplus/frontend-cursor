-- Rename rollout step 1: user_sniper_profile -> student_profile (direct rename strategy)
-- Idempotent and compatibility-safe.
--
-- Rollback notes:
-- 1) If compatibility layer is not yet applied, rename student_profile back to user_sniper_profile.
-- 2) If compatibility layer exists, drop it first (see student_profile_compat_view.sql rollback).

DO $$
BEGIN
  IF to_regclass('public.student_profile') IS NULL
     AND to_regclass('public.user_sniper_profile') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_sniper_profile RENAME TO student_profile';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.student_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_count INT NOT NULL DEFAULT 0,
  sessions_with_energy_count INT NOT NULL DEFAULT 0,
  sessions_with_pitch_count INT NOT NULL DEFAULT 0,
  baseline_wpm FLOAT,
  baseline_pause_ms FLOAT,
  baseline_dynamic_db FLOAT,
  baseline_emphasis_per_min FLOAT,
  baseline_energy_ratio FLOAT,
  baseline_fatigue_sec FLOAT,
  realtime_level SMALLINT NOT NULL DEFAULT 1,
  realtime_step SMALLINT NOT NULL DEFAULT 1,
  realtime_pitch_baseline_st FLOAT,
  baseline_pitch_range_st FLOAT,
  copilot_profile_bucket TEXT,
  copilot_stage TEXT,
  copilot_pending_count INT NOT NULL DEFAULT 0,
  copilot_last_reviewed_at TIMESTAMPTZ,
  copilot_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.student_profile
  ADD COLUMN IF NOT EXISTS sessions_with_pitch_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS realtime_level SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS realtime_step SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS realtime_pitch_baseline_st FLOAT,
  ADD COLUMN IF NOT EXISTS baseline_pitch_range_st FLOAT,
  ADD COLUMN IF NOT EXISTS copilot_profile_bucket TEXT,
  ADD COLUMN IF NOT EXISTS copilot_stage TEXT,
  ADD COLUMN IF NOT EXISTS copilot_pending_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copilot_last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS copilot_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_student_profile_copilot_group
  ON public.student_profile (copilot_profile_bucket, copilot_stage, copilot_pending_count DESC);

CREATE INDEX IF NOT EXISTS idx_student_profile_pending
  ON public.student_profile (copilot_pending_count DESC, updated_at DESC);

COMMENT ON TABLE public.student_profile IS
  'Canonical per-student adaptive profile. Renamed from user_sniper_profile.';

COMMENT ON COLUMN public.student_profile.copilot_profile_bucket IS
  'Cohort profile bucket key used by Copilot Inbox stack grouping.';
COMMENT ON COLUMN public.student_profile.copilot_stage IS
  'Current admin-facing stage for Copilot Inbox grouping and filtering.';
COMMENT ON COLUMN public.student_profile.copilot_pending_count IS
  'Pending inbox item count used for sidebar sorting.';
COMMENT ON COLUMN public.student_profile.copilot_metadata IS
  'Extensible metadata blob for Copilot/Dojo context fields.';

