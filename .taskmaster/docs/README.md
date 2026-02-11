# Task Master docs (Willab)

**Taskmaster is the only source of truth for this app.** All app description, flow, contracts, implementation notes, and “what is missing” live here. Do not rely on other project docs for the canonical description.

| File | Purpose |
|------|---------|
| **APP_DESCRIPTION.md** | **Single source of truth:** what the app is, homework flow, API paths, GET status mapping, key contracts, implementation checklist, components, what could go wrong, **what is missing**, and **§11 Frontend audit checklist** (what’s done, what to verify, key files). Use this for onboarding, Cursor, and task planning. |
| **ALIGNMENT-WITH-BACKEND-SPEC.md** | Where taskmaster and the backend consolidated MVP spec align vs differ. Use when integrating with the backend repo. |
| **FRONTEND-FLOW-AND-CHANGES.md** | Current frontend flow (step-by-step), status aliases, and **what changed** (before vs now) after homework-flow fixes. Use for “how does the frontend behave today?” and “what was fixed?”. |
| **prd.txt** | Product requirements and roadmap. Run `npx task-master parse-prd .taskmaster/docs/prd.txt` to generate tasks. |
| **schema.sql** | Supabase schema reference (if present). Use for DB-related tasks. |

There are no other canonical docs for the app. The backend repo holds its own spec (CONTRACT-HOMEWORK-FLOW, migrations, OpenAPI). Project root `docs/` may contain archive, migrations, or artifacts (e.g. OPENAPI-V2-RECORDINGS.yaml, STYLING_GUIDELINES.md) but not the app description.
