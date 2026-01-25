-- Comprehensive check: Verify all columns needed for recording_sessions table
-- Based on your SessionStatusResponse type

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recording_sessions'
ORDER BY ordinal_position;

-- Expected columns based on your API contract:
-- id (UUID, primary key)
-- user_id (UUID, foreign key to auth.users)
-- session_id (UUID)
-- pre_questions_completed (BOOLEAN)
-- recording_completed (BOOLEAN)
-- post_questions_completed (BOOLEAN)  <-- MISSING
-- recording_id (UUID, nullable, foreign key to recordings)
-- created_at (TIMESTAMPTZ)
-- completed_at (TIMESTAMPTZ, nullable)
-- abandoned_at (TIMESTAMPTZ, nullable)
