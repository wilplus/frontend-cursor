-- Grant backend DB user (e.g. service_role) access to all tables used in the
-- report flow so complete_session_recording_1_only can run without 42501.
--
-- Run this in Supabase SQL Editor (or your Postgres client) after the tables exist.
-- Replace 'service_role' with the role your backend uses (SUPABASE_SERVICE_ROLE_KEY
-- typically uses the service_role role in Supabase).

-- Sniper (self-rating write; baseline read/update)
GRANT SELECT, INSERT, UPDATE ON session_sniper_metrics TO service_role;
GRANT SELECT, INSERT, UPDATE ON user_sniper_profile TO service_role;

-- Session and report (complete_session_recording_1_only)
GRANT SELECT, UPDATE ON v2_sessions TO service_role;
GRANT SELECT, INSERT ON v2_reports TO service_role;

-- Recordings (if the flow reads/updates recordings)
GRANT SELECT, INSERT, UPDATE ON recordings TO service_role;

-- If v2_append_context_long_entry writes to a context_long or similar table, grant it:
-- GRANT SELECT, INSERT, UPDATE ON context_long TO service_role;
-- (Uncomment and adjust table name to match your schema.)
