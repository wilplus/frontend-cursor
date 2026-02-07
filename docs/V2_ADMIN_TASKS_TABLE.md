# Admin: Global tasks table (Focus Tasks pool)

The admin panel has **no separate “Tasks” tab**. Tasks are managed only from **Students → [student] → Homework Configuration → Focus Tasks**. The backend still needs a **global tasks pool** so admins can create/select focus tasks per student.

Run the following in the **Supabase SQL Editor** (or via your backend migrations) to create the table expected by `GET/POST/PUT/DELETE /v2/admin/tasks`.

```sql
-- Global tasks pool for admin "Focus Tasks" (assigned per student via overrides.assigned_next_task_ids).
-- Required for: GET/POST/PUT/DELETE /v2/admin/tasks

CREATE TABLE IF NOT EXISTS public.v2_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  prompt_text TEXT,
  min_task_score NUMERIC,
  max_task_score NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: RLS (adjust to your backend auth)
ALTER TABLE public.v2_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend can manage v2_tasks"
  ON public.v2_tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

If your backend uses a different table name (e.g. `tasks`), create that instead and point the API to it. Column names should match the API contract: `id`, `title`, `prompt_text`, `min_task_score`, `max_task_score`, `is_active`, `created_at`.

After creating the table, reload the PostgREST schema cache in Supabase if needed (Settings → API → Reload schema cache).
