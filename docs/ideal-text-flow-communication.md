# Ideal-text flow — how the app talks to the user between takes

**Status:** DRAFT — every user-facing string below is held for founder sign-off (LIVE LOOP).
**Date:** 2026-08-05. **Founder ask:** *"the sequencing system, I need that to be as smooth as
possible, between the ideal text and the next take… they need to be special but accompanied with
the text description and follow-ups so that user can safely navigate and should not be feeling
left alone in the process; but the communicates should not be too long."*

---

## 1 · The sequence being designed

The founder's own statement of it:

```
recording → ideal text is done → new version ready → communicate → recording 2 → …
```

Written out as the states the user actually passes through:

| # | State | What the user just did | What the app owes them |
|---|-------|------------------------|------------------------|
| S0 | **Idle / ready** | Nothing, or finished a loop | One clear way in: record |
| S1 | **Recording** | Tapped record, is speaking | Deck + clock, nothing else |
| S2 | **Uploading** | Stopped | "Got it" — instant, before any analysis |
| S3 | **Analysing** | Waiting | Proof of life + what's coming + no dead end |
| S4 | **Version ready** | Waiting ends | The artifact, named and numbered |
| S5 | **Read / present** | Opened the text | Room to read; present mode |
| S6 | **Invited back** | Read it | The next take, offered — never demanded |

S3 → S4 is the seam the founder is pointing at. It is where the user is most likely to feel
abandoned, because it is the only state where **they can do nothing and the app is not visibly
doing anything either**.

---

## 2 · What the research says

Four findings drive every decision below.

**a. Uncertainty, not duration, is the problem.** Users who see progress feedback wait roughly
**3× longer** before abandoning — a median 22.6s vs 9s with no visibility
([NN/g](https://www.nngroup.com/articles/progress-indicators/)). The wait is not what hurts; not
knowing whether the system is alive is.

**b. Past ~10 seconds you must show something.** NN/g's three response-time limits are 0.1s
(instant), 1.0s (flow preserved), and **10s (attention span boundary)** — past 10s an operation
needs an explicit indicator or the user starts wondering whether it crashed
([NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)). Our analysis is
tens of seconds to minutes. It is firmly in indicator territory.

**c. Encouraging news helps; discouraging news drives people away.** An *accurate* progress
indicator makes things **worse** when the early news is bad. This is the finding that kills the
obvious design — a precise "3 of 47 slides processed" would be honest and would make people
leave.

**d. Microcopy must say what happens next, not just what is happening.** The advice is
consistent: state the real outcome, sound like a person rather than a log line, and anticipate
the feeling the user is having.

---

## 3 · The rules that follow

**R1 — Never a bare spinner past 10 seconds.** A spinner says "alive." It does not say "what" or
"then what." Every wait over ~10s carries a line of text.

**R2 — Say what is coming, not how the analysis judged the speaker.** The processing screen may
show the real operational job percentage; it must never turn that number into an analysis
result, score, verdict, or slide-quality counter. AC-9 still applies to evaluation, not to the
truthful completion state of the job itself.

**R3 — Two sentences, hard cap.** The founder: *"the communicates should not be too long."*
One line of state and, only where needed, one line of what's next. Active processing is the
explicit one-line case because its status control is itself the way back into the detailed
processing view. If a third sentence seems necessary, the state machine is wrong, not the copy.

**R4 — Every terminal state has an exit.** No state may leave the user with nothing to tap.
S4 → open the text. S5 → present, or record again. A failure → retry. "Left alone" is precisely
the feeling of a screen with no next action.

**R5 — The chat is the ledger.** Founder: *"it all is registered in the chat always; cause the
chat is the registration of all the actions that are happening in the app."* Every state
transition that produces an artifact posts exactly one bubble. Transient states (uploading,
analysing) do **not** post bubbles — they are live chrome, not history. A bubble is a thing that
happened; a spinner is a thing that is happening.

**R6 — Two bubbles are special, the rest recede.** Founder: *"it surfaces the ideal text bubble
and the voice lab bubble and these are the two most important bubbles rest is important not."*
The ideal-text card and the orange recording card are the load-bearing pair. Everything else
(feedback, insight, transcript-ready) stays a plain grey line.

**R7 — The bubble is a title, a date, and a way in.** Founder, explicitly: *"not text that it
really lands on the 3rd time; on the bubble never; just the title, date and the CTA."*
Encouragement, nudging and explanation belong in the flow, not stamped permanently into
history. A bubble is read once when it arrives and a hundred times on scroll-back — anything
motivational in it is noise by the third read, and a lie by the tenth.

**R8 — Never offer the record button while a version is still landing.** Founder: *"there is no
new button to record unless the text is displayed and waiting is finished."* This is a
correctness rule, not a style one: the ideal-text version is now the spoken take count, so a
take started mid-assembly races the version that is being written.

---

## 4 · The states, concretely

Copy is **provisional — founder sign-off required**. Strings live in
`src/components/willab/flowCopy.ts` so signing off means editing one file.

### S2 · Uploading — *instant, no bubble*
> **Got that.**

Under a second in the good case. It exists so the transition from "I was speaking" to "the app
has it" is never ambiguous.

### S3 · Analysing — *live chrome, no bubble*
> **Working on your take.**

One line, founder-approved 2026-08-26. The status control opens the detailed processing view, so
the second explanatory line is removed rather than left dormant.

The detailed view shows the real job percentage. It never presents that operational progress as
an evaluation of the speaker. No time estimate — we would be guessing, and a missed estimate is
worse than none.

**If it runs long** (past ~90s), the line softens rather than escalating:
> **Still working.**
> Longer takes take longer to go through.

### S4 · Version ready — *the ideal-text bubble*
The bubble itself carries **title · date · CTA** and nothing else (R7). The *communication* rides
beside it as a single chat line:
> **Your ideal text is ready.**

That is the whole message. What used to be here — *"Your ideal text gets sharper with more takes
— three is where it really lands"* — is removed. It was a nudge stamped into permanent history,
which R7 forbids and which reads as pressure on scroll-back.

### S5 · Reading — *the document*
Present mode lives in the header. The document is the surface; nothing competes with it.

### S6 · Invited back — *one line, after the read*
> **Record it again whenever you're ready.**

An invitation, not an instruction. The founder's framing throughout is that the user chooses to
go again because the artifact got better, not because the app asked them to. Engagement is not a
goal here (R3 in the decision filter) — the next take exists because it improves the text.

---

## 5 · Failure

The one state the research is loudest about and products are worst at.

> **That take didn't go through.**
> Your earlier takes are safe — try recording again.

Names what failed, bounds the damage (the user's real fear is that they lost everything), and
gives the exit (R4). Never "Error", never a code.

---

## 6 · What this deliberately does not do

- **No percentages, counters, or ETAs** — finding (c) and AC-9 agree.
- **No streak, no "you're on take 2 of 3" pressure** — the take target is not a quota, and
  engagement mechanics are DRIFT under the decision filter.
- **No bubble for transient states** — R5. The chat would fill with "analysing…" ghosts that
  mean nothing an hour later.
- **No third sentence anywhere** — R3.

---

## 7 · Sign-off checklist

- [ ] S2 "Got that."
- [x] S3 "Working on your take."
- [ ] S3-long "Still working." / "Longer takes take longer to go through."
- [ ] S4 "Your ideal text is ready."
- [ ] S6 "Record it again whenever you're ready."
- [ ] Failure "That take didn't go through." / "Your earlier takes are safe — try recording again."

---

## Sources

- [Progress Indicators Make a Slow System Less Insufferable — NN/g](https://www.nngroup.com/articles/progress-indicators/)
- [Response Time Limits: 0.1s, 1s, 10s — NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [Visibility of System Status (Usability Heuristic #1) — NN/g](https://www.nngroup.com/articles/visibility-system-status/)
- [Designing for Long Waits and Interruptions — NN/g](https://www.nngroup.com/articles/designing-for-waits-and-interruptions/)
- [UI patterns for async workflows, background jobs, and data pipelines — LogRocket](https://blog.logrocket.com/ux-design/ui-patterns-for-async-workflows-background-jobs-and-data-pipelines/)
- [Designing Better Loading and Progress UX — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/designing-better-loading-progress-ux/)
- [Chat UI Design — UXPin](https://www.uxpin.com/studio/blog/chat-user-interface-design/)
