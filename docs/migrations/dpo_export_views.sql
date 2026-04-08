-- DPO export views.
-- Includes only audited/overridden Copilot rows with structured reason chips.
--
-- Rollback notes:
-- - DROP VIEW IF EXISTS public.v_dpo_export_copilot_overrides;
-- - DROP VIEW IF EXISTS public.v_dpo_export_copilot_chips;

CREATE OR REPLACE VIEW public.v_dpo_export_copilot_chips AS
SELECT
  c.draft_id,
  ARRAY_AGG(c.chip_key ORDER BY c.created_at, c.chip_key) AS reason_chip_keys,
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'chip_key', c.chip_key,
      'block_name', c.block_name,
      'custom_reason', c.custom_reason,
      'created_by', c.created_by,
      'created_at', c.created_at
    )
    ORDER BY c.created_at, c.chip_key
  ) AS reason_chip_details
FROM public.admin_copilot_annotation_chips c
GROUP BY c.draft_id;

CREATE OR REPLACE VIEW public.v_dpo_export_copilot_overrides AS
SELECT
  d.id AS draft_id,
  d.student_id,
  d.session_id,
  d.cohort_id,
  d.created_at,
  d.updated_at,
  d.last_edited_by,
  d.approved_by,
  d.approved_at,
  d.sent_at,
  d.ai_insight AS rejected_ai_text,
  COALESCE(NULLIF(d.corrected_insight, ''), NULLIF(d.comment_draft, '')) AS chosen_coach_text,
  chips.reason_chip_keys,
  chips.reason_chip_details,
  (TO_JSONB(sp) ->> 'copilot_profile_bucket') AS profile_bucket,
  (TO_JSONB(sp) ->> 'copilot_stage') AS stage_key,
  JSONB_BUILD_OBJECT(
    'profile_bucket', (TO_JSONB(sp) ->> 'copilot_profile_bucket'),
    'stage_key', (TO_JSONB(sp) ->> 'copilot_stage'),
    'session_id', d.session_id,
    'cohort_id', d.cohort_id
  ) AS context_metadata
FROM public.admin_copilot_student_drafts d
LEFT JOIN public.student_profile sp ON sp.user_id = d.student_id
LEFT JOIN public.v_dpo_export_copilot_chips chips ON chips.draft_id = d.id
WHERE
  (
    COALESCE(d.good_as_is, FALSE) = FALSE
    AND (
      NULLIF(d.corrected_insight, '') IS NOT NULL
      OR NULLIF(d.comment_draft, '') IS NOT NULL
    )
  )
  OR chips.reason_chip_keys IS NOT NULL;

COMMENT ON VIEW public.v_dpo_export_copilot_chips IS
  'Per-draft structured reason chips for DPO export payloads.';
COMMENT ON VIEW public.v_dpo_export_copilot_overrides IS
  'Audited/overridden Copilot rows for DPO export (rejected AI + chosen coach + reasons + context).';

