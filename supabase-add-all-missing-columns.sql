-- Add all missing columns to recordings table
-- Run this in Supabase SQL Editor

-- Step 1: Add classification column
ALTER TABLE public.recordings
ADD COLUMN IF NOT EXISTS classification TEXT;

-- Step 2: Add confidence column
-- (TEXT type because it stores categorical values like "low", "medium", "high")
-- If you already added it as NUMERIC, drop and recreate it:
ALTER TABLE public.recordings
DROP COLUMN IF EXISTS confidence;

ALTER TABLE public.recordings
ADD COLUMN confidence TEXT;

-- Step 3: Add duration_seconds column (backend expects this name)
-- Your table has 'duration' but backend expects 'duration_seconds'
-- Use NUMERIC to accept both integers and decimals (e.g., 48.0)
ALTER TABLE public.recordings
ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC;

-- If column already exists as INTEGER, convert it:
-- ALTER TABLE public.recordings
-- ALTER COLUMN duration_seconds TYPE NUMERIC;

-- Sync existing data
UPDATE public.recordings
SET duration_seconds = duration
WHERE duration_seconds IS NULL AND duration IS NOT NULL;

-- Step 4: Add storage_path column (for Supabase Storage file path)
ALTER TABLE public.recordings
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Step 5: Add transcription_text column (backend expects this name, not 'transcription')
-- Your table has 'transcription' but backend expects 'transcription_text'
ALTER TABLE public.recordings
ADD COLUMN IF NOT EXISTS transcription_text TEXT;

-- Sync existing transcription data
UPDATE public.recordings
SET transcription_text = transcription
WHERE transcription_text IS NULL AND transcription IS NOT NULL;

-- Step 6: Add coaching_report column
ALTER TABLE public.recordings
ADD COLUMN IF NOT EXISTS coaching_report TEXT;

-- Or if it's a percentage (0-100):
-- ALTER TABLE public.recordings
-- ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,2); -- e.g., 95.50

-- Or if it's a simple integer (0-100):
-- ALTER TABLE public.recordings
-- ADD COLUMN IF NOT EXISTS confidence INTEGER;

-- Step 7: Verify all columns were added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name IN ('classification', 'confidence', 'duration_seconds', 'storage_path', 'transcription_text', 'coaching_report')
ORDER BY column_name;

-- Step 8: Check all columns in recordings table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
ORDER BY ordinal_position;
