# Task Master docs (Willab)

Reference files for task-master and AI context. Do not delete.

| File | Purpose |
|------|---------|
| **APP_DESCRIPTION.md** | **Single source of truth** for the app: what it is, flow explained, components involved, and what could go wrong. Use this first for onboarding, flow explanation, and debugging. |
| **prd.txt** | Product requirements aligned with the project. Describes what is in place and what remains. Run `npx task-master parse-prd .taskmaster/docs/prd.txt` to generate tasks. |
| **schema.sql** | Current Supabase schema (tables, columns, constraints). Use as the single source of truth for the database when implementing features or writing tasks. |

## Unify with project docs

- **APP_DESCRIPTION.md** (this folder) — Unified app description: flow, components, failure modes. Start here.
- **prd.txt** — PRD and roadmap; references APP_DESCRIPTION.md and root docs for implementation details.

For deeper specs and contracts, see **project root docs/**:

- **docs/STEPS-TO-MAKE-FLOW-WORK.md** — Implementation steps and checklist.
- **docs/EXAMPLE-GET-SESSION-STATUS-RESPONSES.md** — GET status contract and mapping.
- **docs/BACKEND_PROMPT_API_PATHS.md** — API paths (frontend /api vs backend /v2).
- **docs/WARM_UP_SELECTION_SPEC.md** — Warm-up selection algorithm.
- **docs/BACKEND_ADMIN_SYNC_AFTER_SIMPLIFIED_UI.md** — Admin API contract.

When writing or executing tasks, use APP_DESCRIPTION.md and these docs for contracts and specs.
