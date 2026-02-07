# Unify focus_tasks, warm_up_tasks, and post_recording_questions

You want **three sections** on the student profile that all use the **same mechanism** as **focus_tasks** (which already works): list, Add, Edit, Delete, "Manage list" → Confirm selection → **PUT sync** with list of IDs → refetch. No divergent code.

---

## Current state (what exists today)

| Section | Mechanism | Works? |
|--------|-----------|--------|
| **Focus tasks** | Per-student table (`v2_focus_tasks`) + pool (`v2_focus_task_pool`). GET list, POST/PUT/DELETE per task, **PUT sync** `pool_task_ids`. | ✅ Yes |
| **Warm-up tasks** | Same UI and BFF as focus. Per-student table + pool. **Backend is missing PUT sync** (no `PUT .../warm-up-tasks` with `pool_task_ids`). | ❌ Confirm selection does not persist |
| **Post-recording questions** | **Different**: stored in `overrides.assigned_post_question_ids`. Pool = global post-recording questions. "Confirm" only updates local draft; user must click **Save** (putOverrides) to persist. No dedicated PUT sync endpoint. | ⚠️ Two-step flow, not same as focus |

---

## Gaps and decisions you need to make

### 1) Backend in this workspace?

- **This repo = frontend only.** I cannot edit your Flask backend from here.
- **To do “once for all” including backend:** Add your backend repo to the workspace (e.g. open both folders in Cursor), or run a second chat in the backend repo with the same prompt.

### 2) Post-recording questions: same storage or new table?

- **Option A – Keep overrides (minimal backend change)**  
  Backend adds one endpoint: **PUT** `/v2/admin/students/:id/post-recording-questions` with body `{ "question_ids": string[] }`. Handler updates `overrides.assigned_post_question_ids` and returns 200. Frontend then uses the same pattern as focus: "Confirm selection" calls this PUT and refetches (no separate Save for that section).

- **Option B – New table like focus_tasks (full parity)**  
  Backend adds a per-student table (e.g. `v2_post_recording_assignments`) and pool, plus GET/POST/PUT/DELETE and **PUT sync** with `question_ids`. Frontend uses the exact same pattern as focus_tasks (same component shape, different API path and state key). Bigger change.

**Recommendation:** Option A if you only need the same *flow* (Confirm → persist immediately). Option B if you want identical data model and API shape to focus_tasks.

### 3) What to delete / replace

- **Frontend:** Remove any logic that differs from the focus_tasks pattern (e.g. post-recording’s “update draft + Save” flow). Replace with: load list from API, Manage list → Confirm → call PUT sync with selected IDs → refetch. Use focus_tasks as the single template; warm_up and post_recording become the same structure with different names and API paths.
- **Backend:** For warm-up, add PUT sync (see `docs/BACKEND_WARM_UP_SYNC_PUT.md`). For post-recording, either add PUT that updates overrides (Option A) or add full table + sync (Option B).

---

## Master prompt (copy-paste this)

Use this in the **frontend** chat (this repo). If the backend is in the same workspace, you can add the second paragraph.

**Frontend (this repo):**

```
Use focus_tasks as the only template. On the student profile page there are three sections: Focus tasks, Warm-up tasks, Post-recording questions. I want all three to use the same mechanism:

1. Load: GET the student’s list for that section (focus_tasks, warm_up_tasks, or assigned post-recording question IDs from overrides/API).
2. List: show items with Edit and Delete (and optional “Max score” where applicable).
3. Add: modal with task/question text (and max score for focus/warm-up), Save → POST to create, then refetch.
4. Edit: same modal, Save → PUT by id, then refetch.
5. Delete: confirm → DELETE by id, then refetch.
6. Manage list: open pool modal, select items, Confirm selection → PUT sync with the ordered list of IDs (pool_task_ids for focus/warm-up, question_ids for post-recording), then refetch. No separate “Save” step for that section.

Remove any code that does something different (e.g. post-recording updating a draft and requiring a separate Save). Make warm_up and post_recording sections mirror focus_tasks in structure and flow, only changing API paths and state keys. Assume the backend will expose: for warm-up, PUT /v2/admin/students/:id/warm-up-tasks with body { pool_task_ids }; for post-recording, either PUT /v2/admin/students/:id/post-recording-questions with body { question_ids } that updates overrides, or the same table+sync pattern as focus (tell me which you implemented).
```

**Backend (if in same workspace or separate chat):**

```
Implement the same pattern as focus_tasks for warm-up and (if chosen) for post-recording:

1. Warm-up: Add PUT /v2/admin/students/<id>/warm-up-tasks (no task_id) with body { "pool_task_ids": string[] }. Replace the student’s warm-up tasks with rows from v2_warm_up_task_pool in that order (delete existing, insert from pool). Return { "warm_up_tasks": [...] }. See docs/BACKEND_WARM_UP_SYNC_PUT.md.

2. Post-recording (choose one):
   - Option A: Add PUT /v2/admin/students/<id>/post-recording-questions with body { "question_ids": string[] }. Update overrides.assigned_post_question_ids and return 200.
   - Option B: Add per-student table + pool and PUT sync (same shape as focus_tasks), and expose GET/POST/PUT/DELETE + PUT sync with question_ids.
```

---

## What to answer before running the prompt

1. **Post-recording:** Option A (PUT updates overrides) or Option B (new table + full sync)?
2. **Backend:** Will you run the backend part in this workspace (backend folder open) or in a separate chat/repo? If separate, I’ll do frontend only and you’ll need to apply the backend spec yourself.
3. **Scope:** Should I only refactor the student profile page (three sections), or also align BFF routes and admin-client so all three use the same method names and response shapes where possible?

Once you answer those three, you can paste the master prompt and I’ll unify the code without worsening what’s already working.
