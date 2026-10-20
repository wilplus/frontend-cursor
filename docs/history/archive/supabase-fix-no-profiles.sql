-- Fix: Disable profile creation (since you don't need Supabase profiles)
-- Run this in Supabase SQL Editor → New Query

-- Step 1: Check if there's a trigger trying to create profiles
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- Step 2: Check if there's a function trying to create profiles
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%profile%' OR routine_name LIKE '%handle_new_user%');

-- Step 3: Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 4: Drop the function if it exists (optional - only if you're sure you don't need it)
-- DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 5: Verify the trigger is gone
SELECT 
  trigger_name
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name LIKE '%profile%' OR trigger_name LIKE '%user%';
