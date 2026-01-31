-- Fix recording_sessions table for questionnaire flow
-- The questionnaire replaces the old pre-questions, so we need to ensure
-- pre_questions_completed is set correctly when questionnaire is submitted

-- 1. Ensure pre_questions_completed column exists
ALTER TABLE recording_sessions
ADD COLUMN IF NOT EXISTS pre_questions_completed BOOLEAN DEFAULT FALSE;

-- 2. Add columns to store questionnaire data (optional, for analytics)
ALTER TABLE recording_sessions
ADD COLUMN IF NOT EXISTS mood TEXT,
ADD COLUMN IF NOT EXISTS readiness INTEGER,
ADD COLUMN IF NOT EXISTS inspiration_needed BOOLEAN,
ADD COLUMN IF NOT EXISTS cursor NUMERIC,
ADD COLUMN IF NOT EXISTS mode TEXT;

-- 3. Update existing sessions that might be stuck
-- If a session has a recording_id but pre_questions_completed is false,
-- it means the old flow was used - mark them as completed
UPDATE recording_sessions
SET pre_questions_completed = TRUE
WHERE recording_id IS NOT NULL 
  AND pre_questions_completed = FALSE;

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_recording_sessions_user_status 
ON recording_sessions(user_id, pre_questions_completed, recording_completed, post_questions_completed);

-- 5. Verify the structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'recording_sessions'
  AND table_schema = 'public'
ORDER BY ordinal_position;
