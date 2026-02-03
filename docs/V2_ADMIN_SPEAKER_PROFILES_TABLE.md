# Fix: "Could not find the table 'public.v2_speaker_profiles'"

The admin panel Speaker Profile section can trigger a **PGRST205** error from Supabase/PostgREST:

```text
Could not find the table 'public.v2_speaker_profiles' in the schema cache
Hint: Perhaps you meant the table 'public.v2_exercises'
```

This means the backend (or Supabase) is querying a table that does not exist yet. The frontend does not reference this table directly; the BFF proxies to the Flask backend, which then talks to Supabase.

## Fix: Create the table in Supabase

Run the following in the **Supabase SQL Editor** (or via your backend migrations) to create the `v2_speaker_profiles` table expected by the v2 admin API.

```sql
-- v2_speaker_profiles: one row per user for admin-editable speaker profile fields.
-- Required for admin panel "Speaker Profile" section (GET/PUT /v2/admin/students/:id/speaker-profile).

CREATE TABLE IF NOT EXISTS public.v2_speaker_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  main_goal TEXT,
  motivation TEXT,
  strong_points TEXT,
  weak_points TEXT,
  charismatic_traits TEXT,
  hobbies_interests TEXT,
  personality_type TEXT,
  coach_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: RLS policies (adjust to your auth rules)
ALTER TABLE public.v2_speaker_profiles ENABLE ROW LEVEL SECURITY;

-- Example: allow service role / backend to read and write (backend uses service key)
-- If your backend uses the anon key with a custom claim for admin, add a policy that checks that.
CREATE POLICY "Backend can manage v2_speaker_profiles"
  ON public.v2_speaker_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

If your backend uses the **Supabase service role key**, it bypasses RLS, so the policy is only needed if you use the anon key with RLS. Adjust or drop the policy to match your backend auth.

After creating the table, **reload the PostgREST schema cache** if needed (e.g. in Supabase: Settings → API → “Reload schema cache” or restart the API). Then the admin Speaker Profile section should work.

**If the error persists:** The backend (Flask) may expect a different table or schema. In the backend repo, check which table name is used for speaker profiles and ensure the Supabase table and column names match.
