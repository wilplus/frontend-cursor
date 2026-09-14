# BE handoff: connect the breakthrough moment + coach breakthrough video

**From:** Frontend
**Date:** 2026-06-19
**Scope:** Wire the breakthrough moment end-to-end and let a coach attach one explanatory video to it. The explanation text reuses the existing coach comment — no new text field. The FE already consumes everything (renders the video when present, nothing when null), so this is non-breaking.

## How the FE shows a breakthrough now
In the user readout, tapping a moment expands it in place: player → **coach comment** → metrics → breakthrough block. For a snippet with `breakthrough === true`, the breakthrough block renders a fixed celebratory headline (*"🥳 Here you turned your stress into charisma!"*) plus the coach's breakthrough video. **The text that explains the breakthrough is the coach comment itself** (`coach.note`), shown just above — there is no separate breakthrough-explanation text.

## The asks

### 1. Connect the breakthrough moment (confirm)
Each readout snippet already carries `breakthrough: boolean`. Confirm the BE sets it on the correct snippet (the challenge take that followed a threat snippet) and returns it on both the raw readout and the published results. No new field for the flag.

### 2. Coach breakthrough video — new nullable field
Let a coach attach **one** video to a breakthrough snippet during review, surfaced to the user as a ready-to-use public URL:

```jsonc
// on each readout snippet:
{
  "breakthrough": true,
  "breakthrough_video_ref": "https://.../breakthrough-clip.mp4" | null
}
```
- Public URL, same shape/hosting as `insights_payload.video_ref` (a `*_public_url`), so the FE drops it straight into `<video>`. No signed-URL handshake.
- `null` / omitted when no video. Only meaningful when `breakthrough === true`.
- **Coach upload path:** add it to the coach review/publish write path, alongside the per-snippet `note` / `tag` / `surfaced` the coach already sets — i.e. a coach can upload a breakthrough video for a snippet the same way they author its note. (If upload tooling is a bigger lift, ship the read field first so the FE can render, and wire the coach upload next.)
- Same field name everywhere readout snippets are returned (raw readout + published results), so the FE mapper stays single-path.

### 3. Explanation text = the coach comment (no new text field)
The breakthrough explanation is the existing user-facing `coach.note`. **Do not add a separate breakthrough-explanation text field.** The FE no longer renders `breakthrough_note` in the breakthrough block; you can stop populating it for this purpose (leave it or retire it — the FE ignores it there).

## FE side (already done)
- `ReadoutSnippet.breakthroughVideoRef: string | null` ← `breakthrough_video_ref` (`src/components/willab/readout.ts`).
- Breakthrough block renders headline + `breakthroughVideoRef` video; explanation comes from `coach.note` shown above (`src/components/willab/ReadoutCard.tsx`).

## Open question for BE
For the coach upload: is the breakthrough video a coach action in the existing review surface (one upload per breakthrough snippet, like the note), or auto-generated? Either is fine for the FE — it only needs the public URL on `breakthrough_video_ref`.

---

## Phase 2 — the upload endpoint the FE now expects (coach authoring is wired)

The coach review card already shows the "Add a breakthrough video" placeholder (it appears once the coach labels a snippet **challenge**) and the FE is fully wired end-to-end: a file upload posts through a BFF proxy to a per-snippet upload endpoint, then saves the returned URL via the existing per-snippet save. **The only missing piece is this BE endpoint** — until it ships, the upload soft-fails and the coach sees a retry (no broken state).

Build it to mirror the session-level coach video upload (`POST /v2/coach/sessions/<sid>/video`):

```
POST /v2/coach/sessions/<session_id>/snippets/<snippet_id>/breakthrough-video
Content-Type: multipart/form-data
  - video_file (binary; same MIME whitelist + size limits as the coach session video)

200 → { "breakthrough_video_ref": "https://media.willpowerlab.com/.../clip.mp4" }
```

- Reuse the existing coach-video storage pipeline; return a ready-to-use public URL.
- Auth: same `require_admin_or_coach` + session-ownership check as the session-video upload.
- The FE then PERSISTs it via `POST /v2/coach/sessions/<sid>/snippets/<nid>` with `{ "breakthrough_video_ref": "<url>" }` (PR #131 contract). So the upload endpoint only needs to store + return the URL; it does **not** need to write `coach_state` itself (though it may, idempotently).

FE pieces already in place: BFF route `src/app/api/v2/coach/sessions/[sessionId]/snippets/[snippetId]/breakthrough-video/route.ts`, service `uploadBreakthroughVideo` (`src/services/api/coachReview.ts`), UI in `CoachSnippetReviewCard.tsx`.
