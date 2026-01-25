-- Option 2: Disable profile creation (if you DON'T need profiles)
-- Run this in Supabase SQL Editor

-- Check if there's a trigger trying to create profiles
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- If you find a trigger like 'on_auth_user_created', drop it:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Check if there's a function trying to create profiles
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%profile%' OR routine_name LIKE '%user%';

-- If you find a function like 'handle_new_user', you can either:
-- 1. Drop it: DROP FUNCTION IF EXISTS public.handle_new_user();
-- 2. Or modify it to not create profiles
