-- Fix storage_path column issue
-- Run this in Supabase SQL Editor

-- Step 1: Check if the column already exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name = 'storage_path';

-- Step 2: Add the column if it doesn't exist
ALTER TABLE public.recordings
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Step 3: Verify it was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name = 'storage_path';

-- Step 4: If PostgREST cache is stale, you may need to:
-- - Wait a few seconds for cache to refresh
-- - Or restart your Supabase project (if possible)
-- - Or the column name might have a typo - check for 'storage_path' vs 'storagePath' etc.

-- Step 5: Check for any similar column names (in case of typo)
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name LIKE '%storage%' OR column_name LIKE '%path%';
