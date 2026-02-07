# Admin panel implementation status

**Reference:** There is **no "Tasks" tab** in the admin nav; only **Students**. Focus tasks are managed inside each student profile (e.g. "Select Focus Tasks" modal). The **`/api/admin/tasks`** API is used by that flow — it is **not** a separate tab. The BFF route **`src/app/api/admin/tasks/route.ts`** (and **`tasks/[id]/route.ts`**) is **required** so the student profile can load and create focus tasks; without it, the profile gets 404 when using Focus Tasks.

For full details (what the frontend calls, what BFF routes exist, deployment notes), see **ADMIN_IMPLEMENTATION_AUDIT.md**.
