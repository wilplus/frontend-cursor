-- ============================================================================
-- V1: Add command_option_id to recordings (required for POST /recordings/upload)
-- ============================================================================
-- The frontend sends command_option_id ("A" | "B" | "C") with each upload.
-- Backend must persist it. Run in Supabase SQL Editor. Idempotent.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'recordings' AND column_name = 'command_option_id'
  ) THEN
    ALTER TABLE public.recordings
    ADD COLUMN command_option_id TEXT;
    -- Optional: constrain to A/B/C for new rows (existing rows stay NULL)
    -- ALTER TABLE public.recordings ADD CONSTRAINT chk_command_option_id
    --   CHECK (command_option_id IS NULL OR command_option_id IN ('A', 'B', 'C'));
  END IF;
END $$;
