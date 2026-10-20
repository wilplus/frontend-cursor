# willab — FE Clearing Map
**Companion to** `willab_design_decisions_beta.md` (§1–§14). This is the **"what already exists"** half: a grounded map of the willab-beta design onto the *current* FE repo, so build-agents implement the **delta**, not blind.
**Read-only audit.** Every verdict cites a real path. `UNVERIFIED` where not confirmed. Verdicts: **REUSE · ADAPT · RELOCATE · DELETE · BUILD-NEW · CROSS-REPO(BE) · CONFLICT/RISK.**

> **Headline finding (read §9 first):** this repo currently hosts **two live products** — the **homework flow** *and* the **charisma/stress chat funnel** — and the willab beta is a third restructure of the chat funnel. The design doc is silent on the homework product. **Replace-vs-coexist is the single biggest unmade decision and it gates the whole build scope.** See Decisions §9.1.

---

## 1. Verdict matrix (by design section)

| Design (§) | Element | Verdict | Path(s) / evidence | Note |
|---|---|---|---|---|
| §2 | `DomainChips` (5 chips) | **BUILD-NEW** | — | clone the deleted `CharismaStress` chip pattern |
| §2 | Intake surface (conversational, non-recording) | **BUILD-NEW** | — | reuse `ThreadView` + a **text-only** `ChatInputBar` variant (no mic) |
| §2 | the old "onboarding" interview | **DELETE** | `ChatInterview.tsx`, `useChatPhase.ts` (`onboarding` phase) | it is *not* the intake — see §2 deletions |
| §3 | Lounge = home hub | **ADAPT (major)** | `app/chat/page.client.tsx`, `useChatPhase.ts`, `thread/ThreadView.tsx`, `thread/useThread.ts` | the phase machine is the substrate; invert so Lounge=home, Lab=overlay |
| §3 | Lounge bot | **REUSE** | `app/api/v2/chat/query/route.ts` (master-doc RAG) | + add library to context (§7) + librarian guardrail |
| §3 | Lounge speech (Web Speech) | **REUSE** | `hooks/useDualCaptureMic.ts` | local, unmeasured |
| §3 | warm-opener | **RELOCATE** | `useOnboardingOpener.ts`, `OpenerMicButton.tsx`, `api/v2/onboarding/opener/*`, `onboardingOpenerSeen.ts` | detach from first-run → optional Lounge first-touch; rework to 4 auto-bubbles, never gate CTA |
| §3 | `lounge_messages` persistence | **CROSS-REPO(BE)** + **BUILD-NEW(FE glue)** | pattern: `lib/funnel/pendingSession.ts` | FE localStorage + merge-on-signup glue is new |
| §4 | big-mic recording engine | **ADAPT** | `funnel/ChatInterview.tsx`, `funnel/VoiceRecordButton.tsx` | strip the steering interview + completion gate + contextual-next-question; keep mic/`MediaRecorder` + upload |
| §4 | Lab-as-overlay shell | **BUILD-NEW** | — | overlay over the always-mounted Lounge |
| §4 | `session_context` form (topic req) | **BUILD-NEW(FE)** + **CROSS-REPO(BE)** | BE shipped Task 9 (`c695b41`); **FE form was never built** | confirm |
| §4 | min-content gate (≥60 s + has-speech) | **ADAPT** | salvage from `ChatInterview.tsx` completion-gate | content-validity only |
| §4 | `parked` state | **BUILD-NEW** | — | first-class post-recording state |
| §5 | Readout card | **BUILD-NEW** | — | per-snippet; reuse `SnippetPlayer` |
| §5 | `SnippetPlayer` | **REUSE** | `chat/RichBubbles.tsx` (def), used by `thread/*`, `useReviewingFetch.ts` | per-card playback |
| §5 | raw librosa features | **CROSS-REPO(BE)** | — | BE pipeline must emit the 10-feature set |
| §6a | status region | **BUILD-NEW** | — | linear single-active |
| §6a | publish signals | **REUSE / ADAPT (re-point)** | `hooks/usePublishLiveSubscription.ts`, `useReviewingFetch.ts`, `ResultsReadyEmail.tsx`, `api/v2/internal/publish-session-results/route.ts`, `funnel/PendingSessionClaim.tsx` | re-point from the retired `reviewing` phase → status region |
| §6b | Insights view | **BUILD-NEW** | — | annotated Readout (reuse the Readout card) |
| §7 | strong-sides library store | **CROSS-REPO(BE)** | — | FE: bot-context expansion only |
| §8 | state model | **ADAPT** | `thread/types.ts` `Phase` union | see §state-map below |
| §12 | Welcome + consent screen | **BUILD-NEW** | — | single lightweight screen |
| §13 | Send gate | **ADAPT** | reuse OAuth screen + `PendingSessionClaim` handoff | park-before-redirect + merge-then-send + confirm-on-send = new glue |
| §14 | Coach authoring surface | **BUILD-NEW** | — | new surface, **reuse components** (below), **not** Tab 1 |
| §14 | coach note card | **REUSE (pattern)** | the coaching-rationale card in `admin/users/[userId]/page.tsx` (~L1314) | split-sink editable card |
| §14 | overall coach message | **REPURPOSE** | `admin/NextSessionIcebreakerCard.tsx` + its BFF routes | icebreaker → coach message |
| §14 | labels store + direction label | **CROSS-REPO(BE)** | — | training zone, private |

**State map (§8):** current `Phase` = `loading · onboarding · compiling · metrics_ask · welcome_back · opening · q_and_a · reviewing · roleplaying · error` (`thread/types.ts`). New needs: `welcome_consent · intake_in_progress · lounge_idle · lab_session_context · lab_prerecord · lab_recording · lab_processing · readout · parked · sendgate_* · review_pending · insights_ready · lounge_general`. Rough mapping: `q_and_a`→Lounge (ADAPT); `onboarding/compiling/metrics_ask/roleplaying`→Lab states (ADAPT, strip steering); `reviewing`→status/Insights (RETIRE+re-point); `welcome_back/opening`→DELETE/RELOCATE.

---

## 2. DELETE list + blast radius (sequence before building over them)

| Target | Blast radius (importers / call-sites) | Replaced by |
|---|---|---|
| `AcousticMetricsBubble` + `metrics` bubble kind | `app/chat/page.client.tsx`, `RichBubbles.tsx`, `useReviewingFetch.ts`, `thread/types.ts`, `thread/ThreadView.tsx`, `funnel/ChatInterview.tsx` (6) | Readout card (§5) |
| **User self-labeling** — `CharismaStress`, `action_pending` bubble, `YesNoPills` (label use), `/v2/user/snippets/[id]/label`, `useSnippetLabelingChain` | `page.client.tsx`, `slots/CharismaStress.tsx`, `thread/toolbar.ts`(+test), `RichBubbles.tsx`, `thread/ThreadView.tsx`, `useRecordingHandoff.ts`, `useReviewingFetch.ts`, `api/v2/user/snippets/[snippetId]/label/route.ts` (~10) | nothing (dropped, §9 spec) |
| `CasualVoiceConsentModal` | `chat/ChatInputBar.tsx` (1 importer) | first-run disclosure + browser `getUserMedia` |
| charisma/stress steering interview + completion gate | `ChatInterview.tsx`, `useChatPhase.ts` (`onboarding`/`metrics_ask`), the contextual-next-question wiring | min-content gate only (§4) |
| `reviewing` phase | `useReviewingFetch.ts`, `useChatPhase.ts`, `useQAComposer.ts`, `RecordingReadyPanel.tsx`, `TrialRecordingBubble.tsx`, `thread/{types,useThread,toolbar}.ts`, `useRecordingHandoff.ts` | status region (re-point signals, don't rip) |

⚠️ The user-labeling and `reviewing` deletions have the widest footprints — they thread through `toolbar.ts`, `ThreadView`, and several hooks. Delete *after* the new Readout/Insights/status surfaces exist, or you'll break the live `/chat`.

---

## 3. REUSE inventory (exists, used as-is or near-as-is)
`SnippetPlayer` · `useDualCaptureMic` · `usePublishLiveSubscription` · `useReviewingFetch` (re-point) · `ResultsReadyEmail` · `PendingSessionClaim` · `publish-session-results` BFF · `/v2/chat/query` (Lounge bot) · the OAuth auth screen · `ThreadView`/`useThread` (thread substrate) · `lib/admin/wordDiff.ts` (coach-note gate) · the coaching-rationale card pattern.

## 4. BUILD-NEW (true greenfield, FE)
`DomainChips` · Intake surface · Lab overlay shell · `session_context` form · Readout card · status region · Insights view · Welcome/consent screen · Coach-authoring surface · the Lounge-as-home restructure · `parked`/`insights_ready`/`lab_*`/`sendgate_*` state handling · `lounge_messages` localStorage+merge glue · send-gate park→OAuth→merge-then-send glue.
*(BE BUILD-NEW = the 5 stores + pipeline; see the BE map.)*

## 5. ADAPT (exists, modify)
- `page.client.tsx` + `useChatPhase.ts` — restructure the phase machine to Lounge-home / Lab-overlay; swap the old phases for the new states.
- `ChatInterview.tsx` — strip steering interview + gate + contextual questions; keep the mic engine → Lab.
- `ChatInputBar.tsx` — drop `CasualVoiceConsentModal`; serve the Lounge composer (text + small mic) **and** the intake text-only variant.
- `/v2/chat/query` — add the user's library to bot context + the librarian guardrail (§7).
- `publish-session-results` + signals — re-point to the status region; carry the Insights payload + fire the training-annotation event.
- `NextSessionIcebreakerCard` + its 2 BFF routes — repurpose into the coach message.

---

## 6. Admin reconciliation (the design doc's thinnest area) — **DECISION-NEEDED**

Current admin surfaces (`src/app/admin/`): `users/[userId]` (4-tab) · `students` · `training-studio` · `acoustic-dojo` · `voice-labeling` · `ml` · `snippets` · `recordings` · `metrics` · `copilot-inbox` · `questions` · `tasks` · `tasks-pool` · `exercises` · `email-preview` · `user`.

| Surface | Recommended | Why / flag |
|---|---|---|
| `users/[userId]` (4-tab) | **FOLD + KILL** | fold the rationale card + snippet review into the new §14 coach-authoring; kill the trinity/KPI/charisma-stress chrome (deleted user-side). **DECISION: which bits fold.** |
| `training-studio`, `acoustic-dojo`, `voice-labeling`, `ml` | **KEEP? (decision)** | classifier-training tooling — in-scope/private per §14. But it predates the `direction-v1` label. **DECISION: keep as-is, or align labeling to the direction schema + fold into coach-authoring.** |
| `snippets`, `recordings`, `metrics` | **KEEP-ish** | admin inspection tooling; low conflict. Confirm. |
| `copilot-inbox` | **DECISION** | purpose unclear vs the beta; audit before keep/kill. |
| `questions`, `tasks`, `tasks-pool`, `exercises`, `students` | **HOMEWORK product** | these are the *other* product's admin (§9.1). KILL iff homework is replaced; KEEP iff coexist. **Gated on the §9.1 decision.** |
| `email-preview` | **KEEP** | dev tool, harmless. |

## 7. Cross-repo dependencies (BE must provide — see the BE map)
The 5 stores (`lounge_messages`, library, `session_context`, `profile`, labels) · Whisper→ffmpeg→librosa pipeline + the 10-feature set · stickiness scorer · segmentation **top-N cap** · the publish event carrying the **Insights payload + training-annotation** + `insights_ready` flip · coach-packet assembly **excluding Lounge** · classifier/labels store.

## 8. Conflicts / risks
1. **Two products in one repo** (homework + chat funnel) → the willab restructure is a *third* layer. High risk of cross-wiring; see §9.1.
2. **The `/chat` phase machine is a shared substrate** for the restructure — every surface hangs off `useChatPhase`/`useThread`; rework carefully, behind the new states.
3. **Wide deletion footprints** (user-labeling, `reviewing`) thread through `toolbar.ts` + hooks → must be sequenced after the replacements exist.
4. **Shared publish signals** (`usePublishLiveSubscription` etc.) serve the old `reviewing` flow → re-point, don't rip.

## 9. Decisions surfaced (do NOT resolve in build — answer these first)
1. **🔴 Homework product: REPLACE or COEXIST?** The full homework flow — `components/homework/HomeworkFlowCard.tsx`, `api/homework/*`, `recording/AudioRecorder.tsx`, `StrengthPaceDartboard.tsx`, `hooks/useRealtimeStrengthPace.ts`, + admin `exercises/tasks/tasks-pool/students` — is a separate **live** product the willab design ignores. **REPLACE** = a massive deletion + the admin loses those surfaces. **COEXIST** = routing + admin must host both products. *This gates total build scope; nothing else should start until it's answered.*
2. **Classifier/labeling tooling** (`training-studio`/`acoustic-dojo`/`ml`/`voice-labeling`): keep as the (private, in-scope) classifier-training side, or re-align to the `direction-v1` schema and fold into §14 authoring?
3. **`users/[userId]` 4-tab**: which components fold into coach-authoring, which die?
4. **The current chat funnel cutover**: the live `/chat` (cold-start → onboarding → metrics → signup → reviewing) is fully replaced by the willab loop per the design — confirm, and sequence the cutover so `main` stays shippable mid-migration.
5. **`session_context` FE form**: never built (Task 9 shipped BE-only) — confirm BUILD-NEW.

---
*Read-only audit. Verdicts grounded in the scan above; `CROSS-REPO` items are the BE agent's to confirm. The build sequence consumes this map + the BE map.*
