# Willab

Next.js frontend for Willab (practice interview sessions, Supabase auth, Flask backend).

## What to do next (Task Master)

This project uses [Task Master](https://docs.task-master.dev/) for task management. Use the **minimum** of markdown: tasks live in `.taskmaster/tasks/tasks.json` and optional PRD in `.taskmaster/docs/prd.txt`.

- **Next task:** `npx task-master next`
- **List tasks:** `npx task-master list`
- **Parse PRD → tasks:** `npx task-master parse-prd .taskmaster/docs/prd.txt`
- **Expand tasks:** `npx task-master expand --all`

Older docs (implementation notes, prompts, troubleshooting) are in `docs/archive/`.

## Setup

- `npm install`
- Copy `.env.example` to `.env.local` and set Supabase + API URL.
- `npm run dev`

## Scripts

- `npm run dev` — start dev server
- `npm run build` / `npm run start` — production
- `npx task-master next` — show next task (Task Master CLI)
