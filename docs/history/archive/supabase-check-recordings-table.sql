-- Check recordings table schema
-- Run this in Supabase SQL Editor to see what columns exist

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
ORDER BY ordinal_position;

-- Expected columns based on your API contract (GetRecordingResponse):
-- id / recording_id (UUID, primary key)
-- session_id (UUID, foreign key to recording_sessions)
-- user_id (UUID, foreign key to auth.users)
-- transcription_text (TEXT, nullable)
-- status (TEXT)
-- wpm (NUMERIC/FLOAT)
-- filler_count (INTEGER)
-- filler_breakdown (JSONB)
-- duration_seconds (INTEGER)
-- report (TEXT, nullable)
-- trend_sentence (TEXT, nullable)
-- created_at (TIMESTAMPTZ)
