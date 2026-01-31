-- Fix: Add missing column to recording_sessions table
-- Run this in Supabase SQL Editor

-- Step 1: Check current schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recording_sessions'
ORDER BY ordinal_position;

-- Step 2: Add missing column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'recording_sessions' 
      AND column_name = 'post_questions_completed'
  ) THEN
    ALTER TABLE public.recording_sessions
    ADD COLUMN post_questions_completed BOOLEAN DEFAULT FALSE NOT NULL;
    
    RAISE NOTICE 'Added post_questions_completed column';
  ELSE
    RAISE NOTICE 'Column post_questions_completed already exists';
  END IF;
END $$;

-- Step 3: Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recording_sessions'
  AND column_name = 'post_questions_completed';

-- Step 4: Check if there are other missing columns based on your API contract
-- Your SessionStatusResponse expects:
-- - pre_questions_completed
-- - recording_completed  
-- - post_questions_completed
-- - recording_id

-- Verify all expected columns exist:
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'recording_sessions' 
      AND column_name = 'pre_questions_completed'
  ) THEN '✓' ELSE '✗' END as has_pre_questions_completed,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'recording_sessions' 
      AND column_name = 'recording_completed'
  ) THEN '✓' ELSE '✗' END as has_recording_completed,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'recording_sessions' 
      AND column_name = 'post_questions_completed'
  ) THEN '✓' ELSE '✗' END as has_post_questions_completed,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'recording_sessions' 
      AND column_name = 'recording_id'
  ) THEN '✓' ELSE '✗' END as has_recording_id;
