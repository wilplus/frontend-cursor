import "server-only";

// The backend base URL + the request-bound Supabase client both live in
// _lib/backend.ts (FE handoff 2026-08-03 §C) — one idiom, one file. Every BFF
// route talks to the backend through callBackend since audit Q-A8 (Phase 4);
// this re-export remains for the server-side ISR readers under
// src/services/api (journalServer.ts), which are not BFF routes.
//
// getCurrentUserIdentity and getCurrentUserId lived here too and had no
// importers left (audit 2026-09-26, glue finding: removable frontend glue).
export { getBackendUrl } from "@/app/api/_lib/backend";
