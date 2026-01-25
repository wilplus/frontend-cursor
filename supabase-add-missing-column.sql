-- Add missing post_questions_completed column to recording_sessions
-- Run this in Supabase SQL Editor

-- First, check what columns you currently have
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recording_sessions'
ORDER BY ordinal_position;

-- Add the missing column
ALTER TABLE public.recording_sessions
ADD COLUMN IF NOT EXISTS post_questions_completed BOOLEAN DEFAULT FALSE NOT NULL;

-- Verify it was added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recording_sessions'
  AND column_name = 'post_questions_completed';
