# Willab — What the app does (frontend perspective)

This document describes the application from the **frontend perspective**: what the user sees, where they go, and what the UI does. It does not describe backend APIs or business logic in detail; it focuses on routes, screens, and user-facing behaviour.

---

## 1. Overview

**Willab** is a public-speaking homework tool. The frontend is a **Next.js** app with two main audiences:

- **Students** — Log in, go to a single **dashboard** where they complete a homework flow: warm-up task, first recording, task text and two metric questions, final task, second recording, optional reflective questions, and a coaching report.
- **Admins** — Log in to an **admin panel**, manage **students**, and configure each student’s homework (warm-up tasks, focus tasks, post-recording questions, metrics, and speaker context). Admins can send homework to students and view reports history.

All API calls from the browser go through **Next.js API routes (BFF)** under `/api`. The BFF proxies to a backend (e.g. Flask) at a configurable base URL; the frontend never calls the backend directly. Authentication is **Supabase** (email/password); the BFF forwards the Supabase session token to the backend.

---

## 2. Entry and authentication

### 2.1 Root and redirects

- **`/` (home):** If the user is **signed in**, they are redirected to **`/dashboard`**. If **not signed in**, they are redirected to **`/login`**.
- There is no public landing page; the app is gated by login.

### 2.2 Auth routes (unauthenticated)

- **`/login`** — Login page. Title “Willab”, subtitle “public speaking homework tool”. Email and password form; “Log out” and “Reset password” links. On success, the user is sent to the path in the `redirectTo` query parameter (if present) or to **`/dashboard`**.
- **`/signup`** — Sign-up page (email/password). After signup, user is directed to sign in (or to update password if required).
- **`/reset-password`** — Request password reset (email). Sends a reset link; the link leads to **`/update-password`**.
- **`/update-password`** — Set new password (e.g. after reset or first login). On success, redirect to **`/dashboard`** or login.

### 2.3 Protected routes (authenticated)

If the user is not signed in and tries to open a protected route, they are redirected to **`/login?redirectTo=<encoded path>`** so that after login they return to the intended page.

Protected routes include:

- **`/dashboard`** — Main student experience (see below).
- **`/profile`** — Placeholder profile page (“Profile page (coming next)”).
- **`/change-password`** — Change password while logged in.
- **`/recordings/[id]`** — Recording detail/feedback (if used).
- **`/admin/*`** — All admin pages (see below).

---

## 3. Student experience: dashboard

### 3.1 Layout and header

- **Route:** **`/dashboard`** (and **`/dashboard/homework`**, **`/dashboard/v2`** redirect to **`/dashboard`**).
- **Layout:** A **DashboardShell** wraps the content: a header and a main area (max-width container, vertical spacing).
- **Header (DashboardHeader):**
  - **Willab** (brand, left; link to `/dashboard`).
  - **User email** (right).
  - **Logout** button; on click, signs out via Supabase and redirects to **`/login`**.

No navigation menu: the student has a single flow on this page.

### 3.2 Main content: homework flow (HomeworkFlowCard)

The main content is a **single homework flow** implemented by **HomeworkFlowCard**. The flow has **5 steps**; the UI shows step bullets (1–5) and the content for the current step. The flow **starts automatically** when the page loads (once the auth state is ready): the app calls the start API and, on success, shows step 1. The user does not click “Start homework”; they see the first step (warm-up + recorder) as soon as the session is ready.

**Loading and errors:**

- While auth is not ready: a card with “Loading…” is shown.
- If the start API fails with a “not available” or 404-style error: the app can enter **preview mode**: it shows step 1 with a placeholder warm-up text and a recorder, plus an amber “Preview mode” banner explaining the backend is not connected. Recording in preview mode does not upload; a message explains that the backend must be implemented.
- If start fails with another error: an error message and a “Try again” button are shown so the user can retry the start call.

Below, each step is described as the user experiences it.

---

#### Step 1: Warm-up task and first recording

- **Progress:** Bullet 1 of 5 is active.
- **Content:**
  - A short **“Preview mode”** banner (only in preview/mock mode).
  - An **error box** with “Try again” (only if start failed and it’s not the “not available” case).
  - A **“Warm-up task”** block: label “Warm-up task” and the warm-up text (from the start API, or “Loading your warm-up task…” with spinner, or “Tap Try again above to load your task.” if there was an error).
  - Either:
    - **AudioRecorder** — Record, then “stop and send”; on completion the app uploads the recording (step “Sending first recording” with spinner) and then moves to step 2; or
    - **“Preparing recorder…”** with spinner — Shown until the session is ready (so the recorder is not shown before the start response).
- **Behaviour:** User reads the warm-up text, records, and the app sends the recording to the backend (or shows an error / preview message). No manual “next” for moving to step 2; it happens after upload succeeds.

---

#### Step 2: Task text and metric questions

- **Progress:** Bullet 2 of 5 is active.
- **Content:**
  - A **“Your task (after first recording)”** block with the task text returned after recording 1.
  - A card titled **“Answer these two questions:”** with:
    - **First metric question** — Label (from API, e.g. `metric_question_1_text`, or fallback “Metric question 1”), textarea for the answer.
    - **Second metric question** — Same pattern.
  - Optional **error** message.
  - **“Continue”** button (loading state: “Submitting…”).
- **Behaviour:** User reads the task, fills in the two metric answers, and clicks Continue. The app submits the answers; on success it receives the final task text and moves to step 3.

---

#### Step 3: Final task and second recording

- **Progress:** Bullet 3 of 5 is active.
- **Content:**
  - **“Final task”** block with the final task text (from the metric-answers API).
  - **AudioRecorder** — Record, then “stop and send”; on completion the app uploads recording 2 (step “Sending second recording” with spinner), then either moves to step 4 (if the backend returns reflective questions) or step 5 (report) if there are no questions.
- **Behaviour:** User reads the final task, records, and the app sends the recording and then fetches the list of questions. If the list is empty, it submits empty answers and fetches the report (step 5). If the list is non-empty, it goes to step 4.

---

#### Step 4: Reflective questions (optional)

- **Progress:** Bullet 4 of 5 is active.
- **Content:**
  - **“A few questions”** heading.
  - For each question returned by the API: **label** (question text) and a **textarea** for the answer.
  - Optional **error** message.
  - **“See my report”** button (loading: “Submitting…”).
- **Behaviour:** User answers the reflective questions and clicks “See my report”. The app submits the answers and receives the report; it then moves to step 5.

---

#### Step 5: Report

- **Progress:** Bullet 5 of 5 is active.
- **Content:**
  - **“Your report”** heading.
  - **Overall score** — Shown if the API returned `performance_score_end` (e.g. “Overall score: 82%”).
  - A **report block** (bordered, muted background) with the **report text** (coaching text from the backend), preserving line breaks.
  - **“Back to dashboard”** link (navigates to **`/dashboard`**).
- **Behaviour:** User reads the report and can go back to the dashboard (which will start a new flow if they continue).

---

### 3.3 Summary of student flow from the frontend

From the user’s point of view:

1. They open **`/dashboard`** and are immediately in the homework flow (no “Start” click).
2. They see a **warm-up task** and **record**; the app uploads and then shows the **task text** and **two metric questions**.
3. They **answer the two questions** and click **Continue**; the app shows the **final task** and a **second recorder**.
4. They **record again**; the app uploads and then either shows **reflective questions** (if any) or goes straight to the **report**.
5. If there are reflective questions, they **answer** and click **See my report**; the app shows the **report** (score + coaching text) and a **Back to dashboard** link.

All steps are linear; there is no branching in the UI except “has questions” vs “no questions” after recording 2. Errors are shown inline or as toasts; the user can “Try again” on start failure or fix and resubmit on later steps. The frontend does not implement “resume”; each visit to the dashboard starts or continues from the current backend session state (e.g. start or status API).

---

## 4. Admin experience

### 4.1 Access and layout

- **Routes:** All under **`/admin`**. Visiting **`/admin`** or **`/admin/exercises`**, **`/admin/metrics`**, **`/admin/questions`**, **`/admin/recordings`** redirects to **`/admin/students`**. So the only admin entry points in normal use are **`/admin`** (redirects to students) and **`/admin/students`**.
- **Auth:** The admin layout checks that the user is signed in; if not, redirect to **`/login?redirectTo=/admin`**. (Admin-specific role checks, if any, are enforced by the backend when the BFF calls admin APIs.)
- **Layout (AdminShell):** Sticky header with “Admin” title, admin user email, and Logout. Main content area below.

### 4.2 Students list — `/admin/students`

- **Heading:** “Students” and short description (e.g. “Manage your students and view their progress”).
- **Search:** A search input (e.g. “Search by email…”). The list is filtered by email or user id as the user types.
- **List:** Each student is a **card** (or row) with:
  - **Email** (or “No email (user_id)”).
  - **Sessions count**, **average performance** (e.g. “Avg: 75%”), **last active** date (if available from the API).
  - A **chevron** or link to the student profile.
- **Click:** Navigates to **`/admin/students/[id]`** (student profile).

### 4.3 Student profile — `/admin/students/[id]`

- **Breadcrumb:** “Students” link back to **`/admin/students`**.
- **Title:** Student email or user id.

The page is organized in **sections** (cards):

---

#### Homework Configuration (one card)

- **Actions (top right):** **“Send Homework”** (outline) and **“Save”** (primary). Save persists overrides and possibly other draft data; Send Homework triggers the backend “send assignment” action for this student.

**Warm-up tasks**

- List of warm-up tasks **for this student**. Each row shows:
  - **Task text** — Editable (inline edit), delete button.
  - **Max score** — Number input (0–1, step 0.01). Tooltip: “Max performance score (0–1). Shown to students with last score ≤ this.” Value is saved on blur.
- **“+ Add”** opens a **modal**: select existing warm-up tasks from the list or **create a new one** (new item is added to this student’s list). On create, the frontend sends a default **max_performance_score** of 1.

**Focus tasks**

- List of **focus tasks** **assigned to this student** (from the global task pool). Each row: **task title** (editable), delete (removes from assignment). **“+ Add”** opens a modal to select from the **global task pool** or create a new task (new task is added to the pool and can be assigned).

**Post-recording questions**

- **Exactly 3** post-recording questions. Subheading shows count (e.g. “Post-Recording Questions (3/3)”). List of the 3 assigned questions (text editable, delete removes assignment). **“+ Add”** opens a modal to select **3 questions** from the **global pool** or create new ones. The UI enforces “exactly 3” (e.g. error if not 3 when confirming).

**Metrics (5 fixed)**

- **5 metric rows**. Each row: index, **left label** and **right label** (e.g. for a scale). Inline edit and save; the frontend sends the full metrics array to the backend. No add/delete; the structure is fixed (5 metrics).

---

#### Speaker profile (one card)

- **“Context”** — Single **textarea** (e.g. goals, motivation, coach notes). **“Save”** button; the frontend sends the value as **coach_notes** (or equivalent) to the backend (e.g. speaker-profile or student update).

---

#### Reports history

- **Heading:** e.g. “Reports History”.
- **List:** Up to a limited number of **past reports** (e.g. 10). Each item is a card with:
  - **Date** (from session `created_at`).
  - **Report preview text** (from `report_preview.report_text_preview` or similar).
- No pagination or “load more” in the described design; the list is finite (e.g. last 10).

---

### 4.4 Modals (student profile)

- **Select from pool** — Used for warm-up tasks, focus tasks, and post-recording questions. Shows a **pool** of items (from the backend). User can **search/filter**, **select** (checkboxes), and **confirm** to apply the selection (e.g. keep selected warm-ups and delete others, or set assigned focus tasks / assigned question ids). **“Create new”** adds a new item (title or text) and adds it to the pool and (depending on section) to the student’s list or assignment.
- **Max selection** — Enforced for post-recording questions (exactly 3).

---

## 5. Other routes (brief)

- **`/profile`** — Protected; placeholder “Profile page (coming next)”.
- **`/change-password`** — Protected; form to change password; link back to dashboard.
- **`/recordings/[id]`** — Protected; recording detail or feedback (if used by email links or admin).
- **`/recordings/[id]/feedback`** — Can be linked from admin or emails; may redirect to login with `redirectTo` to return after auth.
- **`/admin/user/[userId]`** — Legacy or alternate admin view (e.g. user-focused); may link to recordings and feedback.

These are secondary to the main student flow and admin student management.

---

## 6. API usage (frontend perspective)

- **Student:** All requests go to **`/api/homework/...`** (session start, recording-1, metric-answers, recording-2, questions, post-answers). The BFF proxies to the backend. The frontend uses the **Supabase session** (e.g. Bearer token or cookies) on each request; the BFF forwards it.
- **Admin:** All requests go to **`/api/admin/...`** (students, student profile, overrides, speaker profile, send-assignment, warm-up tasks, tasks, post-recording questions, metrics). The BFF uses the same auth and proxies to the backend; the backend may enforce admin role.
- **Mock / no backend:** If the backend is not configured (e.g. no `NEXT_PUBLIC_API_URL`) or mock is enabled (`MOCK_HOMEWORK_BACKEND=1`), the **homework** BFF routes can return **stub JSON** so the student flow runs end-to-end without a real backend (preview mode). Admin APIs are not mocked in the same way; they expect a real backend.

---

## 7. Summary

From the **frontend perspective**, the app:

- **Authenticates** users (Supabase) and redirects unauthenticated users to login.
- **Students** have one main experience: **`/dashboard`**, a linear **homework flow** in 5 steps (warm-up + record 1 → task + metric questions → final task + record 2 → optional questions → report), which **starts automatically** and uses **recordings** and **forms** that submit to the BFF.
- **Admins** have **`/admin/students`** (list with search) and **`/admin/students/[id]`** (profile with **Homework Configuration** — warm-ups with max score, focus tasks, post-questions, metrics — **Speaker profile** — context — and **Reports history**). Modals are used to select or create items from pools; Save and Send Homework persist or trigger backend actions.
- **Errors** and **loading** states are shown inline or via toasts; **preview mode** allows the student flow to be tried without a backend. All server communication goes through the **Next.js BFF** under **`/api`**.

This description is intended to stay accurate from the **user and UI perspective**; backend contracts and behaviour are documented in **BACKEND_PROMPT_API_PATHS.md**, **BACKEND_ADMIN_SYNC_AFTER_SIMPLIFIED_UI.md**, **WARM_UP_SELECTION_SPEC.md**, and **HOMEWORK_FLOW_TECHNICAL_MAP.md**.
