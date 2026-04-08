-- Emergency regrant script for Admin redesign objects.
-- Safe to run multiple times. Use when you see 42501 or missing grants.
--
-- This script assumes migrations already created these objects.
-- If some objects do not exist yet, grants for those objects are skipped.

DO $$
BEGIN
  -- Student profile canonical + legacy compatibility view.
  IF to_regclass('public.student_profile') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.student_profile TO service_role';
  END IF;

  IF to_regclass('public.user_sniper_profile') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sniper_profile TO service_role';
  END IF;

  -- Copilot tables.
  IF to_regclass('public.admin_copilot_cohorts') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_cohorts TO service_role';
  END IF;
  IF to_regclass('public.admin_copilot_student_queue') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_student_queue TO service_role';
  END IF;
  IF to_regclass('public.admin_copilot_student_drafts') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_student_drafts TO service_role';
  END IF;
  IF to_regclass('public.admin_copilot_annotation_chips_catalog') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_annotation_chips_catalog TO service_role';
  END IF;
  IF to_regclass('public.admin_copilot_annotation_chips') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_annotation_chips TO service_role';
  END IF;
  IF to_regclass('public.admin_copilot_send_audit') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_send_audit TO service_role';
  END IF;

  -- Acoustic Dojo tables + views.
  IF to_regclass('public.acoustic_dojo_clips') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoustic_dojo_clips TO service_role';
  END IF;
  IF to_regclass('public.acoustic_dojo_labels') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoustic_dojo_labels TO service_role';
  END IF;
  IF to_regclass('public.acoustic_dojo_weekly_leaderboard') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON public.acoustic_dojo_weekly_leaderboard TO service_role';
  END IF;

  -- DPO export views.
  IF to_regclass('public.v_dpo_export_copilot_chips') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON public.v_dpo_export_copilot_chips TO service_role';
  END IF;
  IF to_regclass('public.v_dpo_export_copilot_overrides') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON public.v_dpo_export_copilot_overrides TO service_role';
  END IF;

  -- Functions (guard with pg_proc lookup).
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'user_sniper_profile_view_insert'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.user_sniper_profile_view_insert() TO service_role';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'user_sniper_profile_view_update'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.user_sniper_profile_view_update() TO service_role';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'user_sniper_profile_view_delete'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.user_sniper_profile_view_delete() TO service_role';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'acoustic_dojo_mark_clip_labeled'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.acoustic_dojo_mark_clip_labeled() TO service_role';
  END IF;
END $$;

