-- Fix duration column name mismatch
-- Your table has 'duration' but backend expects 'duration_seconds'

-- Option 1: Add duration_seconds column and sync with duration
ALTER TABLE public.recordings
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Sync existing data (if any)
UPDATE public.recordings
SET duration_seconds = duration
WHERE duration_seconds IS NULL AND duration IS NOT NULL;

-- Option 2: If you want to rename the column instead (more permanent fix)
-- First, make sure there's no data dependency, then:
-- ALTER TABLE public.recordings
-- RENAME COLUMN duration TO duration_seconds;

-- Option 3: If you want both columns to stay in sync, add a trigger
-- (This ensures duration_seconds always matches duration)
CREATE OR REPLACE FUNCTION sync_duration_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.duration IS NOT NULL AND (NEW.duration_seconds IS NULL OR NEW.duration_seconds != NEW.duration) THEN
    NEW.duration_seconds := NEW.duration;
  END IF;
  IF NEW.duration_seconds IS NOT NULL AND (NEW.duration IS NULL OR NEW.duration != NEW.duration_seconds) THEN
    NEW.duration := NEW.duration_seconds;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep them in sync
DROP TRIGGER IF EXISTS sync_duration_trigger ON public.recordings;
CREATE TRIGGER sync_duration_trigger
  BEFORE INSERT OR UPDATE ON public.recordings
  FOR EACH ROW
  EXECUTE FUNCTION sync_duration_columns();

-- Verify the column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'recordings'
  AND column_name IN ('duration', 'duration_seconds')
ORDER BY column_name;
