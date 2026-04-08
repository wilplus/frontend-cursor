-- Copilot Inbox draft-first persistence.
-- Creates cohort stack, staged drafts, reason chips, and send audit tables.
--
-- Rollback notes:
-- - Drop in reverse dependency order:
--   admin_copilot_annotation_chips -> admin_copilot_send_audit ->
--   admin_copilot_student_drafts -> admin_copilot_student_queue ->
--   admin_copilot_annotation_chips_catalog -> admin_copilot_cohorts

CREATE TABLE IF NOT EXISTS public.admin_copilot_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_bucket TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  pending_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_bucket, stage_key)
);

CREATE TABLE IF NOT EXISTS public.admin_copilot_student_queue (
  cohort_id UUID NOT NULL REFERENCES public.admin_copilot_cohorts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NULL REFERENCES public.v2_sessions(id) ON DELETE SET NULL,
  queue_position INT NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'Draft',
  draft_count INT NOT NULL DEFAULT 0,
  ready_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cohort_id, student_id),
  CONSTRAINT admin_copilot_student_queue_state_chk CHECK (state IN ('Draft', 'Ready', 'Sent'))
);

CREATE TABLE IF NOT EXISTS public.admin_copilot_student_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NULL REFERENCES public.admin_copilot_cohorts(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NULL REFERENCES public.v2_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  ai_insight TEXT NULL,
  corrected_insight TEXT NULL,
  good_as_is BOOLEAN NOT NULL DEFAULT FALSE,
  grade_draft SMALLINT NULL,
  comment_draft TEXT NULL,
  task_draft TEXT NULL,
  email_draft TEXT NULL,
  script_draft TEXT NULL,
  reason_chip_required BOOLEAN NOT NULL DEFAULT TRUE,
  last_edited_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_copilot_student_drafts_status_chk CHECK (status IN ('Draft', 'Ready', 'Sent')),
  CONSTRAINT admin_copilot_grade_draft_range_chk CHECK (
    grade_draft IS NULL OR (grade_draft >= 1 AND grade_draft <= 10)
  )
);

CREATE TABLE IF NOT EXISTS public.admin_copilot_annotation_chips_catalog (
  chip_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_copilot_annotation_chips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES public.admin_copilot_student_drafts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NULL REFERENCES public.v2_sessions(id) ON DELETE SET NULL,
  chip_key TEXT NOT NULL REFERENCES public.admin_copilot_annotation_chips_catalog(chip_key),
  block_name TEXT NOT NULL,
  custom_reason TEXT NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.admin_copilot_send_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NULL REFERENCES public.admin_copilot_student_drafts(id) ON DELETE SET NULL,
  cohort_id UUID NULL REFERENCES public.admin_copilot_cohorts(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NULL REFERENCES public.v2_sessions(id) ON DELETE SET NULL,
  sent_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  send_channel TEXT NOT NULL DEFAULT 'manual',
  send_status TEXT NOT NULL DEFAULT 'sent',
  provider_message_id TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_copilot_send_status_chk CHECK (send_status IN ('staged', 'sent', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_admin_copilot_cohorts_pending
  ON public.admin_copilot_cohorts (pending_count DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_copilot_queue_order
  ON public.admin_copilot_student_queue (cohort_id, queue_position, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_copilot_drafts_student
  ON public.admin_copilot_student_drafts (student_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_copilot_drafts_session
  ON public.admin_copilot_student_drafts (session_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_copilot_chips_export
  ON public.admin_copilot_annotation_chips (created_at DESC, draft_id, session_id);

CREATE INDEX IF NOT EXISTS idx_admin_copilot_send_audit_export
  ON public.admin_copilot_send_audit (created_at DESC, send_status, student_id);

COMMENT ON TABLE public.admin_copilot_student_drafts IS
  'Draft-first staging records for Copilot Inbox Block A/B edits.';
COMMENT ON TABLE public.admin_copilot_annotation_chips IS
  'Structured reason chips attached to draft edits for audit and DPO export.';
COMMENT ON TABLE public.admin_copilot_send_audit IS
  'Explicit per-student send history. Cohort approval must not auto-send.';

