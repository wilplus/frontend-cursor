# Willab Admin Redesign Implementation

This document captures the implemented backend changes in this repo and the frontend integration contract for the separate Next.js admin delivery.

## 1) Backend PR-ready change list

### Migration order (run in this exact order)
1. [`docs/migrations/student_profile_rename_step1.sql`](docs/migrations/student_profile_rename_step1.sql)
   - Renames `user_sniper_profile` -> `student_profile` when needed.
   - Adds additive Copilot grouping fields and indexes.
2. [`docs/migrations/student_profile_compat_view.sql`](docs/migrations/student_profile_compat_view.sql)
   - Creates compatibility view `user_sniper_profile`.
   - Adds INSTEAD OF triggers for insert/update/delete passthrough.
3. [`docs/migrations/copilot_inbox_tables.sql`](docs/migrations/copilot_inbox_tables.sql)
   - Creates Copilot cohort/queue/draft/chips/send-audit tables.
4. [`docs/migrations/acoustic_dojo_tables.sql`](docs/migrations/acoustic_dojo_tables.sql)
   - Creates audio-only clip queue + labels + leaderboard view.
5. [`docs/migrations/dpo_export_views.sql`](docs/migrations/dpo_export_views.sql)
   - Creates audited/overridden-only DPO export views.
6. [`docs/migrations/grant_admin_redesign_tables.sql`](docs/migrations/grant_admin_redesign_tables.sql)
   - Grants `service_role` on all new tables/views/functions.

### Backend/BFF route changes in this repo
- Shared proxy helper with explicit JSON error codes:
  - [`src/app/api/admin/_proxyWithCodes.ts`](src/app/api/admin/_proxyWithCodes.ts)

- Copilot routes:
  - [`src/app/api/admin/copilot/cohorts/route.ts`](src/app/api/admin/copilot/cohorts/route.ts)
  - [`src/app/api/admin/copilot/cohorts/[cohortId]/students/route.ts`](src/app/api/admin/copilot/cohorts/[cohortId]/students/route.ts)
  - [`src/app/api/admin/copilot/students/[studentId]/drafts/route.ts`](src/app/api/admin/copilot/students/[studentId]/drafts/route.ts)
  - [`src/app/api/admin/copilot/students/[studentId]/audit/route.ts`](src/app/api/admin/copilot/students/[studentId]/audit/route.ts)
  - [`src/app/api/admin/copilot/students/[studentId]/approve/route.ts`](src/app/api/admin/copilot/students/[studentId]/approve/route.ts)
  - [`src/app/api/admin/copilot/students/[studentId]/send/route.ts`](src/app/api/admin/copilot/students/[studentId]/send/route.ts)
  - [`src/app/api/admin/copilot/annotation-chips/route.ts`](src/app/api/admin/copilot/annotation-chips/route.ts)

- Acoustic Dojo routes:
  - [`src/app/api/admin/acoustic-dojo/next-clips/route.ts`](src/app/api/admin/acoustic-dojo/next-clips/route.ts)
  - [`src/app/api/admin/acoustic-dojo/labels/route.ts`](src/app/api/admin/acoustic-dojo/labels/route.ts)

- DPO export route:
  - [`src/app/api/admin/dpo/export/route.ts`](src/app/api/admin/dpo/export/route.ts)

### Legacy-safe profile table migration in code paths
- Updated runtime writes/reads to canonical `student_profile`:
  - [`src/lib/realtime-levels/profile-update.ts`](src/lib/realtime-levels/profile-update.ts)
  - [`src/lib/sniper/baseline-update.ts`](src/lib/sniper/baseline-update.ts)
  - [`src/app/api/user/sniper-profile/route.ts`](src/app/api/user/sniper-profile/route.ts)
  - [`src/app/api/user/sniper-profile/session-rating/route.ts`](src/app/api/user/sniper-profile/session-rating/route.ts)

- Compatibility error messaging update:
  - [`src/app/admin/students/[id]/page.tsx`](src/app/admin/students/[id]/page.tsx)

### Admin client integration contract updates
- Added Copilot/Dojo/DPO typed contracts + methods:
  - [`src/lib/api/admin-client.ts`](src/lib/api/admin-client.ts)

### Report score contract preservation
- No changes to existing report endpoint contracts.
- Canonical score remains `score_for_display`; no client-side recomputation contract changes introduced by this redesign.

## API contracts (new)

All error responses from new BFF endpoints:
- `{ "code": "<ERROR_CODE>", "error": "<human-readable>", "details"?: {} }`

Expected backend targets:
- `GET /v2/admin/copilot/cohorts`
- `GET /v2/admin/copilot/cohorts/:cohortId/students`
- `GET|PUT /v2/admin/copilot/students/:studentId/drafts`
- `GET|PUT /v2/admin/copilot/students/:studentId/audit`
- `POST /v2/admin/copilot/students/:studentId/approve`
- `POST /v2/admin/copilot/students/:studentId/send`
- `GET|POST /v2/admin/copilot/annotation-chips`
- `GET /v2/admin/acoustic-dojo/next-clips`
- `POST /v2/admin/acoustic-dojo/labels`
- `GET /v2/admin/dpo/export`

## 2) Frontend PR-ready change list (separate Next.js repo)

### IA and pages
- Add tabs:
  - `Copilot Inbox`
  - `Acoustic Dojo`
- Add routes:
  - `/admin/copilot-inbox`
  - `/admin/acoustic-dojo`

### Copilot Inbox screen
- Left sidebar:
  - Cohort stacks grouped by `profile_bucket + stage_key + pending_count`.
- Main area:
  - Student carousel for selected cohort.
- Student card:
  - Left column: profile/stage cards, justifications, quick overrides.
  - Right Block A (post-hoc audit): AI insight, Good-as-is, corrected insight editor.
  - Right Block B (pre-hoc drafts): grade/comment/task/email/script drafts editable inline.
- Reason chips:
  - Required on edits, supports custom free-text reason.
- Badges:
  - `Draft`, `Ready`, `Sent`.
- Send flow:
  - Cohort-level actions stage only.
  - Explicit per-student `Approve & Send` required.

### Keyboard UX
- `Space`: approve current student item set.
- `E`: toggle edit mode.
- `Tab`: next editable field.
- `Shift+Enter`: approve student and move to next.

### Data integration rules
- Use new methods in [`src/lib/api/admin-client.ts`](src/lib/api/admin-client.ts) as contract reference.
- Keep old endpoints where current admin screens still depend on them.
- Render canonical score fields only (`score_for_display`); do not compute score client-side.

### Acoustic Dojo screen
- Audio-only dark mode screen.
- 10-second loop player.
- 1.0-second input lock before labels are enabled.
- Keyboard:
  - `->` YES
  - `<-` NO
- Display streak, today count, weekly leaderboard panel.

## 3) Risks + mitigations

- Profile rename risk:
  - Mitigation: direct rename plus compatibility view/triggers; keep old name writable during transition.
- Permission (`42501`) regressions:
  - Mitigation: dedicated grants migration for all new objects and helper functions.
- Partial backend rollout:
  - Mitigation: BFF endpoints return explicit JSON `code` errors; frontend can fail gracefully per feature.
- Draft/send race conditions:
  - Mitigation: backend should enforce idempotency key handling on approve/send endpoints.
- Null field and schema drift:
  - Mitigation: tables + client types are nullable-safe; frontend should keep defensive rendering.
- Report score regressions:
  - Mitigation: keep existing report contracts and canonical `score_for_display` behavior untouched.

## 4) Manual test checklist

### Happy path
- Apply migrations in listed order.
- Verify legacy and canonical profile paths:
  - writes to `student_profile`
  - reads via `user_sniper_profile` compatibility view still work.
- Copilot:
  - list cohorts
  - open cohort student list
  - save draft edits
  - save audit edits
  - approve (stage only)
  - explicit send
- Acoustic Dojo:
  - fetch next clips
  - submit labels with confidence
  - verify leaderboard endpoint output.
- DPO:
  - export endpoint returns audited/overridden-only rows with reason chips and context metadata.

### Edge cases
- Missing auth token on all new routes -> `401` with `code=UNAUTHORIZED`.
- Invalid params/body -> `400` with `code=BAD_REQUEST`.
- Backend non-JSON error -> BFF returns `HTTP_xxx` code payload.
- Compatibility view writes:
  - insert/update/delete via `user_sniper_profile` correctly mutate `student_profile`.
- Existing homework flow regression:
  - start -> recording -> self-rating -> report still unaffected.

