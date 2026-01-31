-- Add missing order_index column to post_recording_questions table
-- This column indicates the order of the question within a set (0, 1, or 2)

-- First, ensure the table exists
CREATE TABLE IF NOT EXISTS public.post_recording_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Check if column exists first, then add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'order_index'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;
        
        -- Add check constraint
        ALTER TABLE public.post_recording_questions
        ADD CONSTRAINT chk_order_index 
        CHECK (order_index IN (0, 1, 2));
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.post_recording_questions.order_index IS 
            'Order of question within a set: 0 (scale), 1 (binary), 2 (free_text)';
    ELSE
        RAISE NOTICE 'Column order_index already exists in post_recording_questions';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'post_recording_questions'
AND column_name = 'order_index';
