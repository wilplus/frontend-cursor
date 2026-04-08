-- Post-migration verification for Admin redesign grants.
-- Run in staging after applying:
--   student_profile_rename_step1.sql
--   student_profile_compat_view.sql
--   copilot_inbox_tables.sql
--   acoustic_dojo_tables.sql
--   dpo_export_views.sql
--   grant_admin_redesign_tables.sql
--
-- This script is read-only and helps detect missing privileges that could cause 42501.

-- 1) Verify table/view privileges for service_role.
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'service_role'
  AND table_schema = 'public'
  AND table_name IN (
    'student_profile',
    'user_sniper_profile',
    'admin_copilot_cohorts',
    'admin_copilot_student_queue',
    'admin_copilot_student_drafts',
    'admin_copilot_annotation_chips_catalog',
    'admin_copilot_annotation_chips',
    'admin_copilot_send_audit',
    'acoustic_dojo_clips',
    'acoustic_dojo_labels',
    'acoustic_dojo_weekly_leaderboard',
    'v_dpo_export_copilot_chips',
    'v_dpo_export_copilot_overrides'
  )
ORDER BY table_name, privilege_type;

-- 2) Verify function EXECUTE grants for compatibility/dojo helper functions.
SELECT
  routine_schema,
  routine_name,
  privilege_type
FROM information_schema.role_routine_grants
WHERE grantee = 'service_role'
  AND routine_schema = 'public'
  AND routine_name IN (
    'user_sniper_profile_view_insert',
    'user_sniper_profile_view_update',
    'user_sniper_profile_view_delete',
    'acoustic_dojo_mark_clip_labeled'
  )
ORDER BY routine_name, privilege_type;

-- 3) Optional quick matrix: expected objects that currently have no service_role grants.
WITH expected_objects AS (
  SELECT unnest(ARRAY[
    'student_profile',
    'user_sniper_profile',
    'admin_copilot_cohorts',
    'admin_copilot_student_queue',
    'admin_copilot_student_drafts',
    'admin_copilot_annotation_chips_catalog',
    'admin_copilot_annotation_chips',
    'admin_copilot_send_audit',
    'acoustic_dojo_clips',
    'acoustic_dojo_labels',
    'acoustic_dojo_weekly_leaderboard',
    'v_dpo_export_copilot_chips',
    'v_dpo_export_copilot_overrides'
  ]) AS object_name
),
granted_objects AS (
  SELECT DISTINCT table_name AS object_name
  FROM information_schema.role_table_grants
  WHERE grantee = 'service_role'
    AND table_schema = 'public'
)
SELECT e.object_name AS missing_service_role_grants
FROM expected_objects e
LEFT JOIN granted_objects g ON g.object_name = e.object_name
WHERE g.object_name IS NULL
ORDER BY e.object_name;

