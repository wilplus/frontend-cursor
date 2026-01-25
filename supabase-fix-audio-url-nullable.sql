-- Fix: Make audio_url nullable so backend can insert first, then update later
-- Run this in Supabase SQL Editor

-- Step 1: Check current constraint
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name = 'audio_url';

-- Step 2: Make audio_url nullable
ALTER TABLE public.recordings
ALTER COLUMN audio_url DROP NOT NULL;

-- Step 3: Verify the change
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name = 'audio_url';
