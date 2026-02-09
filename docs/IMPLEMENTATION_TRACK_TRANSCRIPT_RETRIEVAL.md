# Implementation track: Transcript retrieval (GET /v2/recordings/{id})

**Chosen track:** Transcript retrieval endpoint to support report detail and admin debugging **without** changing `/status` or the homework state machine.

**Canonical backend path:** `GET /v2/recordings/{recording_id}` (V2 namespaced).

---

## 1) API contract (locked)

**Endpoint:** `GET /v2/recordings/{recording_id}`

**Minimal response shape (MVP):**

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "session_id": "uuid|null",
  "session_v2_id": "uuid|null",
  "created_at": "iso",
  "transcription_text": "string|null",
  "transcript_preview": "string|null",
  "duration_seconds": 123,
  "words_per_minute": 145,
  "filler_words_count": 6,
  "performance_score_v2": 0.74,
  "performance_metrics_v2": {}
}
```

- `transcription_text` can be `null` if transcription failed.
- `transcript_preview` is optional; see §2.
- BFF and frontend must **not** guess other paths or shapes; this is the single contract.

See `docs/OPENAPI-V2-RECORDINGS.yaml` for the OpenAPI fragment.

---

## 2) One persisted field, two returned fields (recommendation)

- **Store:** Full transcript only in `recordings.transcription_text` (one DB column).
- **Return:** Both `transcription_text` and `transcript_preview`.
  - `transcript_preview = transcription_text.slice(0, 280)` (or first ~2–3 sentences) computed on read.
  - No new DB column; minimal impact.
- **MVP:** Return full transcript; let the UI decide what to show. Later, optional `?preview=1` to reduce payload if needed.

---

## 3) Auth rules (explicit and testable)

Backend must enforce:

- **Student:** Can fetch recording **iff** `recordings.user_id == auth.user_id`.
- **Admin:** Can fetch any recording **iff** `auth.role == admin` (or your admin representation).
- **Otherwise:** Return **404** (safer for resource enumeration) or 403; pick one and document it.

**Important:** If the response includes `session_id` / `session_v2_id`, do **not** allow access by “anyone who knows session_id” — only owner or admin.

---

## 4) BFF proxy (path + pass-through)

- **Path:** Proxy to **`/v2/recordings/{id}`** (canonical backend path).
- **Pass-through:** Do not wrap or reshape the payload. Forward status codes:
  - **200** + JSON body as-is
  - **404** (e.g. RECORDING_NOT_FOUND)
  - **403** (if backend uses it)
- Keeps types stable between backend and frontend.

---

## 5) Frontend: null transcript UX

- When **`transcription_text == null`**: Show **“Transcript unavailable”** (and optionally a link to retry if you add that later). Do not block the rest of the UI (e.g. performance score, metrics, audio) on transcript.

---

## Task list (backend + BFF + frontend)

### Backend

- [ ] Implement **GET /v2/recordings/{recording_id}** with the response shape above.
- [ ] Enforce auth: owner or admin only; 404 (or 403) otherwise.
- [ ] Persist transcript in `recordings.transcription_text` when processing the recording; compute `transcript_preview` on read (e.g. slice first 280 chars).
- [ ] Add integration test: unauthorized user cannot fetch recording they don’t own.

### BFF (this repo)

- [ ] **GET /api/recordings/[id]** proxies to **GET /v2/recordings/{id}** (update path in `src/app/api/recordings/[id]/route.ts` if it currently points to non-v2 path).
- [ ] Pass through 200 / 404 / 403 and body without reshaping.

### Frontend (this repo)

- [ ] **Types:** Align `GetRecordingResponse` with the contract (e.g. `transcript_preview`, `session_v2_id`, `performance_metrics_v2` if used).
- [ ] **Recording detail / feedback page:** Display `transcription_text` when present; when `transcription_text == null`, show “Transcript unavailable” and keep rest of UI usable.
- [ ] **Admin:** Link or embed recording transcript where report/session detail is shown (e.g. link to `/recordings/{id}/feedback?user_id=…`).

### DB

- [ ] No new column required if `recordings.transcription_text` exists; ensure it is populated when transcription runs.

---

## Acceptance criteria

- GET /v2/recordings/{id} (backend) returns the recording with the locked response shape (transcript and/or preview).
- BFF GET /api/recordings/[id] forwards to `/v2/recordings/{id}` and returns the same shape; 200/404/403 passed through.
- Frontend recording detail shows transcript when present; shows “Transcript unavailable” when `transcription_text == null` without blocking the rest of the UI.
- **Unauthorized users cannot fetch recordings they don’t own (verified with integration test).**

---

## Other tracks (for later)

- **Track 1 – Warmup tags + selection priority:** Migration (tags on warmup tasks), admin UI for tagging, backend selection function. See `GAP_RESOLUTION_DECISIONS.md` / warmup selection spec.
- **Track 2 – OpenAPI ↔ handler conformance:** Backend (or shared) contract tests that assert handler responses match `OPENAPI-V2-WRITE-ENDPOINTS.yaml`.
