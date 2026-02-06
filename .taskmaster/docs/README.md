# Task Master docs (Willab)

Reference files for task-master and AI context. Do not delete.

| File | Purpose |
|------|---------|
| **prd.txt** | Product requirements aligned with the project. Describes what is in place (frontend, admin, student flow) and what remains (backend homework endpoints, warm-up selection, final task LLM, report). Run `npx task-master parse-prd .taskmaster/docs/prd.txt` to generate tasks. |
| **schema.sql** | Current Supabase schema (tables, columns, constraints). Use as the single source of truth for the database when implementing features or writing tasks. |

## Unify with project docs

The PRD is the Task Master entry point; the **source of truth** for implementation details lives in the **project root docs/**:

- **docs/WHATS_IN_PLACE.md** — What is built vs what the backend must do.
- **docs/BACKEND_PROMPT_API_PATHS.md** — API paths (frontend /api vs backend /v2).
- **docs/WARM_UP_SELECTION_SPEC.md** — Warm-up selection algorithm (max_performance_score, ±3%, random, first-time, fallback).
- **docs/HOMEWORK_FLOW_TECHNICAL_MAP.md** — Technical flow mapping and open items (final task LLM, report content).
- **docs/BACKEND_ADMIN_SYNC_AFTER_SIMPLIFIED_UI.md** — Admin API contract (students, warm-up tasks, tasks, questions, metrics).

When writing or executing tasks, use these docs for contracts and specs.
