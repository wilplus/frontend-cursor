-- Add missing boolean columns to recording_sessions table
-- Your table uses 'status' but the frontend expects boolean flags
-- Run this in Supabase SQL Editor

-- Step 1: Add the missing columns
ALTER TABLE public.recording_sessions
ADD COLUMN IF NOT EXISTS pre_questions_completed BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS recording_completed BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS post_questions_completed BOOLEAN DEFAULT FALSE NOT NULL;

-- Step 2: If you want to sync existing data from status column to boolean columns
-- (Optional - only run if you have existing sessions you want to migrate)
UPDATE public.recording_sessions
SET 
  pre_questions_completed = CASE 
    WHEN status IN ('pre_questions_completed', 'recording_ready', 'recording', 'recorded', 'post_questions', 'completed') 
    THEN TRUE 
    ELSE FALSE 
  END,
  recording_completed = CASE 
    WHEN status IN ('recorded', 'post_questions', 'completed') 
    THEN TRUE 
    ELSE FALSE 
  END,
  post_questions_completed = CASE 
    WHEN status = 'completed' 
    THEN TRUE 
    ELSE FALSE 
  END
WHERE pre_questions_completed = FALSE OR recording_completed = FALSE OR post_questions_completed = FALSE;

-- Step 3: Verify the columns were added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recording_sessions'
  AND column_name IN ('pre_questions_completed', 'recording_completed', 'post_questions_completed')
ORDER BY column_name;
