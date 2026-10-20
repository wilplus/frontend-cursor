-- Complete fix for questionnaire flow in recording_sessions table
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Ensure all required columns exist
-- ============================================

-- Core completion flags (should already exist)
ALTER TABLE public.recording_sessions
ADD COLUMN IF NOT EXISTS pre_questions_completed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recording_completed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS post_questions_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Questionnaire data columns
ALTER TABLE public.recording_sessions
ADD COLUMN IF NOT EXISTS mood TEXT,
ADD COLUMN IF NOT EXISTS readiness INTEGER,
ADD COLUMN IF NOT EXISTS inspiration_needed BOOLEAN,
ADD COLUMN IF NOT EXISTS cursor NUMERIC,
ADD COLUMN IF NOT EXISTS mode TEXT;

-- ============================================
-- STEP 2: Fix existing sessions that might be stuck
-- ============================================

-- If a session has a recording_id, it means recording was uploaded
-- So pre_questions must have been completed (even if flag is wrong)
UPDATE public.recording_sessions
SET pre_questions_completed = TRUE
WHERE recording_id IS NOT NULL 
  AND pre_questions_completed = FALSE;

-- If status is 'recording_ready' or beyond, pre_questions are completed
UPDATE public.recording_sessions
SET pre_questions_completed = TRUE
WHERE status IN ('recording_ready', 'recording', 'recorded', 'post_questions', 'completed')
  AND pre_questions_completed = FALSE;

-- ============================================
-- STEP 3: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_recording_sessions_user_status 
ON public.recording_sessions(user_id, pre_questions_completed, recording_completed, post_questions_completed);

CREATE INDEX IF NOT EXISTS idx_recording_sessions_user_active
ON public.recording_sessions(user_id, status)
WHERE status NOT IN ('completed', 'abandoned');

-- ============================================
-- STEP 4: Verify the structure
-- ============================================

SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recording_sessions'
ORDER BY ordinal_position;

-- ============================================
-- STEP 5: Check for any problematic sessions
-- ============================================

-- Find sessions that should have pre_questions_completed = TRUE but don't
SELECT 
  id,
  user_id,
  status,
  pre_questions_completed,
  recording_id,
  mood,
  readiness,
  created_at
FROM public.recording_sessions
WHERE (
  -- Has questionnaire data but flag is false
  (mood IS NOT NULL OR readiness IS NOT NULL) 
  AND pre_questions_completed = FALSE
)
OR (
  -- Has recording but flag is false (shouldn't happen after step 2)
  recording_id IS NOT NULL 
  AND pre_questions_completed = FALSE
)
ORDER BY created_at DESC;

-- ============================================
-- Expected Result After Running This Script:
-- ============================================
-- 1. All required columns exist
-- 2. Existing stuck sessions are fixed
-- 3. Indexes created for faster queries
-- 4. Verification query shows correct structure
-- 5. Problematic sessions query shows any remaining issues
