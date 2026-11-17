# Speech- and prompt-to-presentation: research for WillpowerLab "Generate my deck"

Research date: 16 Nov 2026 (Europe/Warsaw). Sources are public help-centre articles, product pages and vendor blogs (links per row). I did not sign into any product, so the flows below come from official documentation and public marketing material, not from hands-on sessions; in-app screenshots behind logins were not captured. Public page captures and Open Graph images are in `research/img/`.

## What I looked at

| Product | Input | Outline / plan step | Generation | Editing & iteration | Voice | Notes for us |
|---|---|---|---|---|---|---|
| **Gamma (Agent, Gamma 5)** — [create flow](https://help.gamma.app/en/articles/15002203-how-do-i-create-with-agent-in-gamma), [mobile app](https://help.gamma.app/en/articles/11016450-does-gamma-have-a-mobile-app) | One prompt bar: a sentence, pasted notes, files, template | **Conversation first.** Plan mode asks a few questions, each with tappable options and **"Decide for me"**. Then a **plan** (story, style, look and feel) that you review and approve; nothing is built until you say go. Express mode skips straight to a draft. | Builds end to end while **narrating its progress**; slides **appear one by one in a live grid**; numbered thumbnail strip | Talk to the agent in plain words ("slide 4 is too text-heavy"). **Targeted revisions**: it changes only what you asked and **tells you which slides it touched**; a slide being edited shows an animated ring. **Per-slide "Edit with Agent"**. **Restyle vs regenerate**: restyling keeps content, regenerate starts over. Hand edits stay put. Undo by asking. | **Mobile app: editing is agent-only, through chat; voice dictation in every chat box** (tap mic, speak, review transcript, send) | Closest to our concept: chat-only on mobile, plan → build → restyle, per-slide edits. |
| **Beautiful.ai (Create with AI)** — [help](https://support.beautiful.ai/hc/en-us/articles/12885226948109-Creating-a-presentation-with-AI), [blog](https://designerbot.com/blog/introducing-the-create-with-ai-workflow) | Prompt (typed or **mic**), files, links | **Low-fidelity text outline** you edit directly or via an AI chat ("delete slides 4, 6 and 9") | Theme, image source (AI/stock/web/none), image style, language, then Generate | Smart Slides auto-layout (300+ layouts); **slide-level AI panel**: see/edit the slide prompt, **generate alternative versions of one slide**, regenerate only its image | Mic for the prompt | Best "regenerate one slide" and layout-alternatives model; desktop-panel heavy. |
| **Canva AI (Magic Design / Presentations)** — [help](https://www.canva.com/en_in/help/using-magic-presentations/), [guide](https://presentationscout.com/blog/how-to-make-an-ai-presentation-in-canva/) | Prompt (or mic), uploads, Brand Kit | Audience / Length / Style dropdowns, then an **editable outline** (add, delete, move sections) | Generate presentation from Canva's template library | Full Canva editor afterwards; re-prompt if off | Mic for the prompt | Beautiful templates; editor is a full design tool (not minimal). |
| **Microsoft Copilot in PowerPoint** — [support, Oct 2026](https://support.microsoft.com/en-us/powerpoint/copilot/create-a-new-presentation-with-copilot-in-powerpoint) | Copilot chat prompt, Word/PDF files, Brand Kit | Clarifying questions (audience, length, design, imagery) you answer or skip; outline review | Builds into your template | Chat-based refinement; Designer layout ideas | — | Enterprise/template-centric. |
| **Google Slides + Gemini** — [help](https://support.google.com/docs/answer/14355071), [guide](https://ryza.si/guides/gemini-in-google-slides) | "Ask Gemini" side panel, Drive sources with @ | Plan you review and approve | Generates slides in the file | Chat edits across the deck | — | Side-panel pattern, desktop. |
| **Pitch (Pitch Agent)** — [help](https://help.pitch.com/en/articles/14844265-create-a-new-presentation), [blog](https://pitch.com/blog/introducing-pitch-agent) | Prompt + files (PDF, MD, CSV, images) + a template | — | Agent builds from template layouts | Refine through chat | — | Polished templates; template-first. |
| **Plus AI** — [guide](https://guide.plusai.com/ai-for-presentations/generate-a-presentation/use-a-prompt), [remix](https://guide.plusai.com/ai-for-presentations/remix-slides) | Prompt inside Google Slides/PowerPoint | Generate outline → edit → generate | Native Slides/PPT output | **Remix** one slide into another layout | — | Good "remix this slide" idea. |
| **Prezi AI** — [features](https://prezi.com/features/ai/), [blog](https://prezi.com/blog/how-to-access-prezi-ai-3-0/) | Prompt or upload | Quick questions → outline you edit | Style/brand then generate | Prezi canvas | — | Zooming canvas; not minimal. |
| **Decktopus** — [help](https://help.decktopus.com/en/articles/111-how-to-create-a-presentation-with-ai) | Topic or file | Style, then outline review | Builds deck | Editor | — | Generic. |
| **Napkin** — [help](https://help.napkin.ai/en/articles/15923699-visuals-generation) | Your text | — | Select text → **sparkle** → several visual options (flow, chart, mind map) | Pick and customise | — | Great pattern for the **visuals pass**: from a sentence to a few visual options. |
| **Presentations.ai** — [App Store](https://apps.apple.com/us/app/presentations-ai/id6480050571) | Prompt, **voice note**, outline, template, file (mobile) | Outline then deck | — | — | Voice-to-text prompt | Mobile-first but standard flow. |
| **Tome** | — | — | — | — | — | Shut down its presentation product in 2025 and pivoted to the CRM Lightfield ([VentureBeat](https://venturebeat.com/technology/tomes-founders-ditch-viral-presentation-app-with-20m-users-to-build-ai)). Not a live option. |
| **Talkpitch (voice-to-slides)** — [page](https://talkpitch.com/features/voice-to-slides) | **Voice only**; optional context (company, metrics) | — | A slide appears after each natural pause (they claim under 1.5 s), 9 auto-chosen layouts | Post-session editor | Deepgram STT; every session doubles as a rehearsal | Genuinely voice-first and pitch-practice oriented, but it is one-shot dictation, not an iterative structure → visuals → style loop. |
| **WingIt, The Slide Machine, SayDeck, Paul** — [WingIt](https://wingit.dev/), [Slide Machine](https://theslidemachine.com/), [SayDeck](https://saydeck.com/), [Paul](https://askpaul.app/en/use-cases/voice-generation) | Live speech / dictated brief | SayDeck: clean into key points, **compare 3 style drafts**; Paul: outline → approve | Real-time or batch | Edit afterwards; Paul: "every change is dictated the same way", touch editor still available | Voice-first | Confirms: dictate → see → correct by voice is a real pattern; SayDeck's "compare 3 styles" fits our style pass. |
| **ChatGPT Voice (Live)** — [help](https://help.openai.com/en/articles/20001274-chatgpt-voice) | Voice inside the normal chat | — | — | — | **Voice lives inside the chat**: the transcript and the answer text appear while speaking; **full-duplex, you can interrupt**; you can type when you can't speak; separate **Dictation** mode for "record, review the transcript, then send" | Voice UX reference: in-thread transcript, interruptible, clear turn states. |
| **Wispr Flow** — [first dictation](https://docs.wisprflow.ai/articles/6409258247-starting-your-first-dictation), [tap vs hold](https://docs.wisprflow.ai/articles/2012729330-why-your-dictation-was-cancelled-tap-vs-hold-and-interrupted-starts) | **Hold to talk, release to insert**; very short taps cancel; Esc cancels | — | — | — | Push-to-talk reference | Voice UX reference: hold-to-talk, release to commit, easy cancel. |

## The pick: Gamma's Agent flow (mobile app style)

**Why Gamma.** Its 2026 create flow is the smoothest and most minimal of the group, and it is the only mainstream one whose *mobile* app is chat-only:
- Editing on mobile is done entirely through the agent chat.
- Dictation is in every chat box.

That is exactly WillpowerLab's constraint: a mobile chat with only a mic, a text field and a send button.

Its loop maps one-to-one onto our three passes:

| Gamma | WillpowerLab |
|---|---|
| A few questions, each answerable with "Decide for me" | Brief: 1–3 spoken answers, "you decide" always works |
| **Plan** you approve before anything is built | **Pass 1 · Structure**: the outline is the plan; "looks good" builds it |
| Live build, narrated, slides appear one by one | **Pass 2 · Visuals**: slides build one by one with narration, and charts/diagrams are suggested with a reason |
| Targeted revisions that say which slides changed; per-slide "Edit with Agent" | Every edit names and highlights the slides it touched; tap a slide to scope the next voice edit to it |
| **Restyle, don't regenerate**: a few style directions, restyle in place | **Pass 3 · Style**: three looks to choose from, restyled in place; content never changes |
| Present | **Practice this deck** (our differentiator: you rehearse what you just built) |

The runners-up each lose on one point:
- **Beautiful.ai** has the best per-slide alternatives, but it is a desktop panel UI.
- **Canva** has the best templates, but its full editor is the opposite of minimal.
- **Talkpitch** is the most voice-first, but it is one-shot dictation with no iterative passes.

I borrow one idea from each instead of copying them.

**What we don't copy.** Gamma's visual design, branding, card styles, theme names, illustrations, colours and copy all stay out. The builder keeps WillpowerLab's visual language: white thread, warm grey bubbles, the orange accent, dark send button and the Sunday-offer sheet style. The slide themes are our own.

## Patterns we adopt

1. **Conversation first, "you decide" everywhere** (Gamma). At most three short questions, every one skippable with "you decide". If the first answer already covers audience and content, the follow-ups are skipped.
2. **Plan before build** (Gamma, Beautiful.ai, Canva, Copilot). The structure pass is a low-fidelity outline: titles and one key message. You can reorder (drag, tap-to-place, or by voice), rename, add and remove slides before anything is designed.
3. **Live, narrated build** (Gamma). Approving the plan builds the slides one by one with a single status line ("Slide 4 of 8 · drawing the 3-step diagram"). It is interruptible.
4. **Targeted, visible changes** (Gamma). Each edit tells you which slides it touched, rings them briefly, scrolls to them, and bumps the minor version (v2.3). Nothing else changes.
5. **Scope an edit to one slide** (Gamma "Edit with Agent", Beautiful.ai slide-level AI). Tap a slide, and the next thing you say applies to it: "another version", "make it a bar chart", "shorter".
6. **Regenerate one slide / alternatives** (Beautiful.ai, Plus AI Remix). "Another version of slide 3" in structure, "different visual" in visuals, "different layout" in style.
7. **Visual options from a sentence** (Napkin). Saying "show the growth" gets you a chart with a one-line reason; "different visual" cycles to the next fitting type.
8. **Restyle with a few directions** (Gamma restyle, SayDeck's three style drafts). The style pass opens with three looks shown as real thumbnails of your own title slide. You can also say a vibe or paste a Canva link. Restyling never changes content.
9. **Undo and go back** (Gamma "undo" by asking). "Undo" reverts the last change in the pass; "back to structure" reopens an earlier pass without losing the visuals or style.
10. **Voice like ChatGPT Voice and Wispr Flow:**
    - **Tap** the mic to dictate. A live transcript streams into the field and you review it before sending (Gamma, Paul, ChatGPT Dictation).
    - **Hold** the mic to talk; releasing sends (Wispr).
    - The states are clear: *listening* (waveform plus live words), *thinking*, *building* (narration), *done* (touched slides ring).
    - **Interruptible**: while the bot works, the send button becomes **stop**, and starting to talk stops the build.
    - Voice works for every edit in every pass, and typing always works when you can't speak.
11. **Practice is the finish line** (Talkpitch's "every session is a rehearsal"). The last step is "practice it", which drops the deck straight into WillpowerLab's recording flow.
