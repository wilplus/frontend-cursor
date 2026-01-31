-- Complete schema for post_recording_questions table
-- Run this to ensure all required columns exist

-- First, check if table exists and what columns it has
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'post_recording_questions'
ORDER BY ordinal_position;

-- Create table if it doesn't exist (without foreign keys first)
CREATE TABLE IF NOT EXISTS public.post_recording_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add session_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'session_id'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD COLUMN session_id UUID;
        
        -- Add foreign key constraint after column exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recording_sessions') THEN
            ALTER TABLE public.post_recording_questions
            ADD CONSTRAINT fk_post_questions_session 
            FOREIGN KEY (session_id) REFERENCES public.recording_sessions(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Add recording_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'recording_id'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD COLUMN recording_id UUID;
        
        -- Add foreign key constraint after column exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recordings') THEN
            ALTER TABLE public.post_recording_questions
            ADD CONSTRAINT fk_post_questions_recording 
            FOREIGN KEY (recording_id) REFERENCES public.recordings(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Add question_type if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'question_type'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD COLUMN question_type TEXT NOT NULL DEFAULT 'scale';
        
        -- Add check constraint
        ALTER TABLE public.post_recording_questions
        ADD CONSTRAINT chk_question_type 
        CHECK (question_type IN ('scale', 'binary', 'free_text'));
    END IF;

    -- Add question_set_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'post_recording_questions' 
        AND column_name = 'question_set_id'
    ) THEN
        ALTER TABLE public.post_recording_questions
        ADD COLUMN question_set_id INTEGER;
    END IF;

    -- Add order_index if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
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
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_post_questions_session_id 
    ON public.post_recording_questions(session_id);

CREATE INDEX IF NOT EXISTS idx_post_questions_recording_id 
    ON public.post_recording_questions(recording_id);

CREATE INDEX IF NOT EXISTS idx_post_questions_set_id 
    ON public.post_recording_questions(question_set_id);

-- Verify all columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'post_recording_questions'
ORDER BY ordinal_position;
