-- Fix question_type check constraint safely
-- First update existing data, then add constraint

-- Step 1: Check what question_type values currently exist
SELECT 
    question_type,
    COUNT(*) as count
FROM public.post_recording_questions
GROUP BY question_type
ORDER BY question_type;

-- Step 2: Update any invalid or NULL values to valid ones
-- If question_type is NULL or invalid, set a default based on order_index
UPDATE public.post_recording_questions
SET question_type = CASE 
    WHEN order_index = 0 THEN 'scale'
    WHEN order_index = 1 THEN 'binary'
    WHEN order_index = 2 THEN 'free_text'
    ELSE 'scale'  -- Default fallback
END
WHERE question_type IS NULL 
   OR question_type NOT IN ('scale', 'binary', 'free_text');

-- Step 3: Drop existing check constraint if it exists
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Try to drop constraint with common names
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.post_recording_questions'::regclass 
        AND conname = 'post_recording_questions_question_type_check'
    ) THEN
        ALTER TABLE public.post_recording_questions
        DROP CONSTRAINT post_recording_questions_question_type_check;
        RAISE NOTICE 'Dropped constraint: post_recording_questions_question_type_check';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.post_recording_questions'::regclass 
        AND conname = 'chk_question_type'
    ) THEN
        ALTER TABLE public.post_recording_questions
        DROP CONSTRAINT chk_question_type;
        RAISE NOTICE 'Dropped constraint: chk_question_type';
    END IF;
    
    -- Drop any other question_type check constraints
    FOR r IN (
        SELECT conname
        FROM pg_constraint 
        WHERE conrelid = 'public.post_recording_questions'::regclass 
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%question_type%'
    ) LOOP
        EXECUTE format('ALTER TABLE public.post_recording_questions DROP CONSTRAINT %I', r.conname);
        RAISE NOTICE 'Dropped constraint: %', r.conname;
    END LOOP;
END $$;

-- Step 4: Verify all data is now valid
SELECT 
    question_type,
    COUNT(*) as count
FROM public.post_recording_questions
WHERE question_type NOT IN ('scale', 'binary', 'free_text')
GROUP BY question_type;

-- If the above query returns rows, there's still invalid data
-- You'll need to manually fix those rows

-- Step 5: Add the correct check constraint
ALTER TABLE public.post_recording_questions
ADD CONSTRAINT chk_question_type 
CHECK (question_type IN ('scale', 'binary', 'free_text'));

-- Step 6: Verify the constraint was added
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.post_recording_questions'::regclass
AND contype = 'c'
AND pg_get_constraintdef(oid) LIKE '%question_type%';

-- Step 7: Final verification - all question types should be valid
SELECT 
    question_type,
    COUNT(*) as count
FROM public.post_recording_questions
GROUP BY question_type
ORDER BY question_type;
