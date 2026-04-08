-- Grants for Admin redesign objects.
-- Run after student_profile + Copilot + Acoustic Dojo + DPO migrations.
-- Ensures backend service_role can read/write required objects (prevents 42501 errors).

-- Student profile canonical table + legacy compatibility view.
GRANT SELECT, INSERT, UPDATE ON public.student_profile TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sniper_profile TO service_role;

-- Compatibility trigger functions.
GRANT EXECUTE ON FUNCTION public.user_sniper_profile_view_insert() TO service_role;
GRANT EXECUTE ON FUNCTION public.user_sniper_profile_view_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.user_sniper_profile_view_delete() TO service_role;

-- Copilot Inbox tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_cohorts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_student_queue TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_student_drafts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_annotation_chips_catalog TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_annotation_chips TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_copilot_send_audit TO service_role;

-- Acoustic Dojo tables and helper function/view.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoustic_dojo_clips TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoustic_dojo_labels TO service_role;
GRANT EXECUTE ON FUNCTION public.acoustic_dojo_mark_clip_labeled() TO service_role;
GRANT SELECT ON public.acoustic_dojo_weekly_leaderboard TO service_role;

-- DPO export views.
GRANT SELECT ON public.v_dpo_export_copilot_chips TO service_role;
GRANT SELECT ON public.v_dpo_export_copilot_overrides TO service_role;

