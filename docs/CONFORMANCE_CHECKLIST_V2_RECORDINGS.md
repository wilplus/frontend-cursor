# Conformance checklist: GET /v2/recordings/{recording_id}

Use this to verify the backend handler and BFF route match the locked contract.

**Contract:** `docs/OPENAPI-V2-RECORDINGS.yaml`  
**Track:** `docs/IMPLEMENTATION_TRACK_TRANSCRIPT_RETRIEVAL.md`

---

## Backend handler

- [ ] **Path:** Handler serves `GET /v2/recordings/{recording_id}` (or equivalent router mount).
- [ ] **Auth:** Student can fetch only when `recordings.user_id == auth.user_id`; admin can fetch any; otherwise return 404 (or 403).
- [ ] **Response 200:** JSON body matches `RecordingV2`: at least `id`, `user_id`, `created_at`, `transcription_text` (nullable), `transcript_preview` (nullable). Optional fields as in schema.
- [ ] **Response 404:** When recording missing or caller not allowed; body can include `error`, `code: RECORDING_NOT_FOUND`.
- [ ] **No reshaping:** Response is the recording entity (or mapped 1:1); no extra wrapping (e.g. no `{ data: { ... } }` unless agreed).
- [ ] **Integration test:** Unauthorized user (or different student) cannot fetch another user’s recording; returns 404 or 403.

---

## BFF route (this repo)

- [ ] **Proxy target:** `GET ${BACKEND_BASE}/v2/recordings/${recordingId}` (see `src/app/api/recordings/[id]/route.ts`).
- [ ] **Pass-through:** Forwards 200, 404, 403 and response body without reshaping.
- [ ] **Auth:** BFF forwards auth header (or cookie-derived token) to backend; no extra auth logic required if backend enforces.

---

## Frontend

- [ ] **Type:** `GetRecordingResponse` (or equivalent) matches `RecordingV2` fields used in UI.
- [ ] **Null transcript:** UI shows “Transcript unavailable” when `transcription_text == null`; rest of page (score, metrics, audio) still works.

---

## Quick verification

1. As **owner**, GET recording by id → 200, body has `transcription_text` and/or `transcript_preview`.
2. As **other student**, GET same id → 404 (or 403).
3. As **admin**, GET any recording id → 200.
4. BFF GET `/api/recordings/{id}` returns same status and body as backend GET `/v2/recordings/{id}`.
