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
