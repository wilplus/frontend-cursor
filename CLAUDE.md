# CLAUDE.md — WillpowerLab (one page)

## What we are building

A speaker records a Take. The app turns it into a transcript, one paragraph
per slide, the **Ideal Text**, and gives evidence-backed feedback after every
Take. Then they record the next Take. That loop is the product.

Second priority: coach review, Confident Voice and practice. These never
slow the loop down.

This repo: **frontend** (Next.js, Vercel, willpowerlab.com). It talks to the
backend, `wilplus/backend-cursor` (Flask, Railway, Supabase), through the BFF
routes under `src/app/api/v2/*`.

## Never

1. **No scores, numbers or verdicts shown to speakers.** Feedback is in words. A processing-progress percentage and a token price are not about the speaker and are allowed (founder, 2026-10-19).
2. **No coach sees the machine's guess before answering.** Coach judgements stay blind.
3. **Never break record → process → Ideal Text → next Take.** Coaches and exercises are never in the way; the plan's questions come once, before the first Take (backend N136, N140).
4. **No new words on screen without the founder's OK.**
5. **The Ideal Text is only what the speaker said in their latest Take.** Their helper words stay until they pick new ones. Every old version stays in the history.

## Screens that are locked

Ideal Text and the Feedback walk, the coach panel, the recording screens and
the consent screens are finished designs. Build them exactly as their
prototypes show. To change one, ask the founder first. A commit that
changes a locked screen's file needs a last line
`Founder-Approved: <where and when the founder said yes>`; the design-lock
check enforces it. The prototypes and
lock files are listed in the backend's [`docs/LOCKS.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/LOCKS.md). The earlier, longer
version of this page is [`docs/history/CLAUDE-2026-10-11.md`](docs/history/CLAUDE-2026-10-11.md).

The Feedback walk and the chat have one page,
[`docs/flows/feedback-walk-and-chat.md`](docs/flows/feedback-walk-and-chat.md): the rules as they stand, what is
in flight, what is open, one line per change. A change to this flow is a
line on that page, never a new file; a commit that changes one of its files
(`scripts/flow-pages.txt`) must change the page too, and the design-lock
check enforces that as well. Every other locked screen has a page of the
same shape here: [`docs/flows/coach-panel.md`](docs/flows/coach-panel.md),
[`docs/flows/ideal-text.md`](docs/flows/ideal-text.md),
[`docs/flows/recording-screens.md`](docs/flows/recording-screens.md),
[`docs/flows/consent-screens.md`](docs/flows/consent-screens.md) and
[`docs/flows/ai-voice-practice.md`](docs/flows/ai-voice-practice.md) (backend N107).

## One source of truth

The single source of truth is the BACKEND repo's `main`
(`wilplus/backend-cursor`), read in this order: [`docs/SPEC-DECISIONS-LOG.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/SPEC-DECISIONS-LOG.md)
(the founder's dated decisions), then [`docs/CANONICAL_PRODUCT_CONTRACT.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/CANONICAL_PRODUCT_CONTRACT.md)
(the numbered clauses), then [`docs/LOCKS.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/LOCKS.md) and the `FOUNDER-LOCK-*.md`
files with their prototypes. Nothing is in force until it is written there
and merged: not a decision said only in chat, a PR description, an open
branch, or this repo's own docs. This repo's [`docs/LOCKS.md`](docs/LOCKS.md) only points to
the backend's (backend N106). Write every founder
decision made in chat into the backend decisions log right away, in its own
small docs PR, never bundled with code that waits for review. Where code on
main disagrees with those docs, the docs win and the code is a bug to fix
(founder, 2026-10-21, backend N95). This repo's flow pages
[`docs/flows/feedback-walk-and-chat.md`](docs/flows/feedback-walk-and-chat.md) and [`docs/flows/coach-panel.md`](docs/flows/coach-panel.md) also
count for their flows, because the frontend design-lock guard requires them
to change together with the code. Every doc in both repos, with its label
(In force, Reference, History or Archive) and a link, is listed in the
backend's [`README.md`](https://github.com/wilplus/backend-cursor/blob/main/README.md) (backend N106).

## Docs

Every doc is listed in the backend's
[`README.md`](https://github.com/wilplus/backend-cursor/blob/main/README.md)
with its label (backend N106). Don't start a new doc: edit the area's rules
page in `docs/flows/` or the master doc. Handoffs and prompts for coding agents
go in the pull request description, not in a file. A new doc needs the
founder's OK and a line in the master doc (backend N107).

## How to ship

- Branch from `main` → PR → checks green → squash-merge. "Merge when green" is standing permission.
- Check locally before pushing: backend `bash scripts/local_ci.sh`, frontend `bash scripts/local_ci.sh`.
- **Merging a migration runs it in production.** Make it idempotent (`IF NOT EXISTS`) and never drop anything. Set any environment variable it needs on every Railway service *before* merging.
- New migrations get an outside review (GPT or Grok) before merging.
- Every speaker's recording and every provider call goes through the processing-authorization path. No shortcuts.

## Before you start a task, ask one question

**Does this make the transcript, the Ideal Text or the feedback better, or
does a task in progress need it?** If not, say so and ask before building it.

## Replacing a feature

Before replacing or redesigning anything, list everything the old one does,
including every backend call and side effect, and keep each one in the new
version. "One in, one out" moves the old tests' promises into the new tests
before the old tests go. Before merging, say what stops happening.

Promises that must never break:

- Every moment a speaker meets reaches a coach (alarm:
  `coach_moments_queue.reach_alarm`, backend).
- The coach's link opens the coach's feedback, whatever else is processing.
- Will learns about each speaker: every answer and every Take's outcome is
  kept, and Will reads the speaker's private note (backend
  `services/speaker_memory.py`, [`docs/SPEAKER-MEMORY.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/SPEAKER-MEMORY.md)). The founder reads
  and corrects it on the person's admin page (`SpeakerMemory.tsx`).

## How to test (founder, 2026-10-12)

Test business behaviour and contracts, not lines of code. Before writing a
test, ask:

- **Does it map to something a speaker, coach or the founder cares about?**
  Test public routes, service contracts and user outcomes, not private
  helpers. A refactor that keeps the output right must not break a test.
- **Is it a duplicate?** If another test already covers it, don't add one.
- **Is it testing someone else's code?** Don't test libraries, the database
  driver or the framework. Test only our own logic.
- **Is it a style or layout check?** No snapshot or CSS tests unless a
  break would stop the app working.
- **Is it an unlikely edge case?** Handle it with defensive code (a
  fallback, a try/except), not with many test variations.
- **ML behaviour:** a strange model result becomes a new row in the one
  golden evaluation set, never a new test script. Bad input data is caught
  by validation in production code, not by mock datasets.
- **One in, one out:** a feature that replaces an old one deletes the old
  one's tests.
- **Time budget:** a test that takes more than a few seconds or mocks
  several services is the wrong test. Make it a small integration check.
- **No coverage target.** Cover the critical path (record → Ideal Text →
  feedback → next Take, consent, deletion, payments), not boilerplate.

## Security

Never ask for or reuse passwords, tokens or keys in chat. Keys go into
environment settings.
