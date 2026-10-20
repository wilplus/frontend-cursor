-- Fix confidence column type mismatch
-- Backend is trying to insert "low" (text) but column is NUMERIC
-- Run this in Supabase SQL Editor

-- Step 1: Check current column type
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name = 'confidence';

-- Step 2: Drop the NUMERIC column if it exists
ALTER TABLE public.recordings
DROP COLUMN IF EXISTS confidence;

-- Step 3: Add it as TEXT instead (for categorical values like "low", "medium", "high")
ALTER TABLE public.recordings
ADD COLUMN confidence TEXT;

-- Step 4: Verify it was added correctly
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name = 'confidence';
