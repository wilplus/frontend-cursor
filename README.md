# Willab

Next.js frontend for Willab (practice interview sessions, Supabase auth, Flask backend).

## What to do next (Task Master)

This project uses [Task Master](https://docs.task-master.dev/) for task management. Use the **minimum** of markdown: tasks live in `.taskmaster/tasks/tasks.json` and optional PRD in `.taskmaster/docs/prd.txt`.

- **Next task:** `npx task-master next`
- **List tasks:** `npx task-master list`
- **Parse PRD → tasks:** `npx task-master parse-prd .taskmaster/docs/prd.txt`
- **Expand tasks:** `npx task-master expand --all`

**App description and flow:** The only source of truth is **`.taskmaster/docs/APP_DESCRIPTION.md`** (and other files in `.taskmaster/docs/`). Do not use other docs for the canonical app description. Older implementation notes and SQL scripts are in `docs/archive/`; `docs/migrations/` and other artifacts may remain in `docs/`.

## Setup

- `npm install`
- Copy `.env.example` to `.env.local` and set Supabase + API URL.
- `npm run dev`

## Scripts

- `npm run dev` — start dev server
- `npm run build` / `npm run start` — production
- `npx task-master next` — show next task (Task Master CLI)
