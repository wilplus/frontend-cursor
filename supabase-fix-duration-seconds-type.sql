-- Fix duration_seconds column type
-- Backend is trying to insert "48.0" (float) but column is INTEGER
-- Run this in Supabase SQL Editor

-- Step 1: Check current column type
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name = 'duration_seconds';

-- Step 2: Change from INTEGER to NUMERIC to accept decimal values
ALTER TABLE public.recordings
ALTER COLUMN duration_seconds TYPE NUMERIC;

-- Or if you want to keep it as integer and force backend to round:
-- Keep it as INTEGER and backend should use Math.round() or int() before inserting

-- Step 3: Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name = 'duration_seconds';
