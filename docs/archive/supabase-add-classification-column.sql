-- Add missing 'classification' column to recordings table
-- Run this in Supabase SQL Editor

-- Step 1: Check current schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
ORDER BY ordinal_position;

-- Step 2: Add the missing classification column
-- (Adjust data type based on what your backend expects - TEXT, JSONB, etc.)
ALTER TABLE public.recordings
ADD COLUMN IF NOT EXISTS classification TEXT;

-- Or if it should be JSONB:
-- ALTER TABLE public.recordings
-- ADD COLUMN IF NOT EXISTS classification JSONB;

-- Or if it should be a specific enum/type:
-- ALTER TABLE public.recordings
-- ADD COLUMN IF NOT EXISTS classification VARCHAR(50);

-- Step 3: Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name = 'classification';
