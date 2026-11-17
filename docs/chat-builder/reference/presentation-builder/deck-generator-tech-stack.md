# WillpowerLab: "Generate my deck": technical stack

Prototype: `chat-continue-prototype-deckgen.html` (step 6 → **No deck? Generate one**, or open `?deckgen=1`).
The AI in it is mocked with keyword rules. This doc covers what it takes to build it for real.

## 1. The core idea: the deck is JSON, never pixels

Every pass edits **one typed JSON document**. The LLM writes it, the user's taps and words patch it, and HTML/PDF/PPTX are all *renderings* of it. That is what makes "only reorder + edit text" in pass 1, versioning per pass, and "talk to change it" cheap and safe.

```jsonc
// Deck (stored per version: v1 structure, v2 visuals, v3 style, final)
{
  "id": "deck_01H…",
  "projectId": "proj_…",              // the WillpowerLab project/chat it belongs to
  "version": { "pass": "visuals", "major": 2, "minor": 1 },
  "brief": { "topic": "WillpowerLab seed pitch", "minutes": 10, "audience": "seed investors",
             "ideas": "...", "keyMessage": "Practising out loud with honest AI feedback makes anyone sound confident" },
  "theme": { "preset": "keynote", "accent": "#2997ff", "titleFont": "Inter Tight", "bodyFont": "Inter",
             "align": "center", "density": "minimal", "photoStyle": "moody", "animation": "partial",
             "source": { "type": "canva", "designId": "DAF…", "extracted": { "palette": ["#f4ece6", "#c2613e"] } } },
  "slides": [ /* Slide[] */ ]
}
```

```jsonc
// Slide (JSON Schema, also used as the LLM's structured-output schema)
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "kind", "title", "keyMessage"],
  "additionalProperties": false,
  "properties": {
    "id":         { "type": "string" },                 // stable across reorders and versions
    "kind":       { "type": "string", "enum": ["title","problem","solution","how","traction","market",
                                                "model","competition","team","roadmap","ask","close","custom"] },
    "title":      { "type": "string", "maxLength": 80 },
    "keyMessage": { "type": "string", "maxLength": 160 },
    "speakerNotes": { "type": "string" },               // feeds the practice/feedback flow
    "targetSeconds": { "type": "integer" },             // from the time limit, drives pacing feedback
    "visual": {                                          // pass 2
      "type": ["object", "null"],
      "properties": {
        "type":   { "enum": ["line","bar","donut","flow","timeline","market","matrix","stat","icons","image"] },
        "why":    { "type": "string" },                 // the user's stated intent, shown on the chip
        "spec":   { "type": "object" },                 // Vega-Lite spec | Mermaid source | {value, caption} | icon ids
        "source": { "enum": ["user","suggested"] }
      }
    },
    "media": {                                           // pass 3
      "type": ["object", "null"],
      "properties": {
        "kind": { "enum": ["generated","stock","upload"] },
        "url": { "type": "string" }, "alt": { "type": "string" },
        "prompt": { "type": "string" }, "attribution": { "type": "string" }
      }
    },
    "layout":    { "enum": ["title","text-left-visual-right","centered","full-bleed-photo","big-number"] },
    "animation": { "enum": ["none","title-then-visual","build-bullets"] }
  }
}
```

Pass rules enforced **in code, not in the prompt**: pass 1 accepts only `reorder` and `setText` patches; pass 2 only writes `visual`; pass 3 only `theme`, `media`, `layout`, `animation`. Each approve = an immutable snapshot (`v1`, `v2`, `v3`, `final`); minor edits bump `v1.1`, `v1.2`… which is what the prototype shows in the stepper.

## 2. Frontend

| Need | Recommendation | Notes |
|---|---|---|
| App shell | Your existing React/TypeScript app (the prototype's comments reference `Lounge.tsx`, `ProjectPicker`, `RecordingSetup`) | Port the prototype's `wlp-*` styles 1:1 into the existing components; the deck builder is one new route/overlay launched from `RecordingSetup` step 6. |
| Slide renderer | A React `<Slide>` component that renders the JSON with CSS container queries (`cqw` units), exactly like the prototype's `.wlp-dslide` | One component serves thumbnails, the editor, the slideshow and the recording screen. Themes are CSS variables. |
| Reorder | **dnd-kit** (`@dnd-kit/sortable`), with keyboard + touch sensors | Add the prototype's tap-to-pick / tap-to-place as the accessible fallback on mobile. |
| Inline text edit | Plain `contentEditable` (as in the prototype) or a minimal **Tiptap** instance per field | Titles/messages are single-line, no rich text, so keep it simple. |
| Animation | CSS keyframes for the in-deck "partial animation"; **Motion** (formerly Framer Motion) for UI transitions | Map the JSON `animation` field to presets; don't let the model write CSS. |
| State | **Zustand** (or your existing store) + **Immer** patches | Patches give you undo, the version history and a compact log to send to the LLM. |
| Live updates | Server-sent events / streaming responses from your API | Stream the chat text *and* JSON patches so slides appear one by one. |

## 3. LLM orchestration: one structured call per pass

Use a model with **schema-constrained output** (OpenAI Structured Outputs, Anthropic tool use with an input schema, or Gemini `responseSchema`). In TypeScript, the **Vercel AI SDK** (`generateObject` / `streamObject` with a Zod schema) wraps all three, so you can switch providers.

Per pass:

1. **Brief agent** (chat): asks the three questions, extracts `{audience, ideas, keyMessage}`; the slide count is computed in code from the time limit (≈ 1 slide/min, capped), not by the model.
2. **Structure (v1)**: input brief → output `slides[{kind,title,keyMessage,speakerNotes,targetSeconds}]`. Then a **command interpreter**: the user's chat turn → `{"op":"move","from":5,"to":2}` / `{"op":"setText",…}` / `{"op":"none","reply":"…"}`. Small/fast model; code applies the op.
3. **Visuals (v2)**: user's requests + slides → `visual` per slide with `why` and a `spec`. For charts, ask for a **Vega-Lite** spec from a whitelisted set of templates, or just data + template id (safer). Validate with the JSON schema before rendering.
4. **Style (v3)**: chat → theme patch (`preset`, `accent`, fonts from an allow-list, `photoStyle`, `animation`, per-slide `media` / `layout` / visual moves). Free text maps to a constrained theme schema, so the output is always renderable.
5. **Practice handoff**: the final deck + speaker notes become the practice script: slide titles become the recording roadmap, and `keyMessage` / `speakerNotes` seed the "ideal text" and helper words you already have.

Good practice: a fast model for the per-turn command interpreter, a stronger model for the one-shot v1/v2 generation; keep a deterministic fallback (as the prototype does) when the model's output fails validation.

## 4. Charts, diagrams, icons

- **Charts**: **Vega-Lite** (declarative JSON, easy for an LLM to fill and to validate) rendered with `vega-embed`; or **Chart.js** if you want something smaller with fewer chart types. Server-side rendering to SVG/PNG is needed for PPTX/PDF export (Vega can render to SVG in Node).
- **Diagrams**: **Mermaid** (flowcharts, timelines, quadrant charts) for anything process-like; for the simple "3 steps" or "2×2" you get nicer results with your own SVG components fed by JSON, as in the prototype.
- **Icons**: **Lucide** (ISC licence, consistent stroke style that matches your current UI icons) or **Phosphor**. Let the model pick icon *names* from the allow-listed set only.

## 5. Photos and images

- **Stock**: **Unsplash API** and **Pexels API** (both free with attribution / usage guidelines; store the attribution in `media.attribution`).
- **Generated**: OpenAI image generation (`gpt-image-1`), Google **Imagen** (Gemini API / Vertex AI), or **FLUX** models via **fal.ai** or **Replicate**. Generate on demand per slide; prompts are built from slide message + `photoStyle` (the model never sees the raw user prompt alone). Add a moderation pass.
- **Uploads**: direct-to-storage signed uploads (S3 / Cloudflare R2 / Supabase Storage), then resize (e.g. `sharp`) for thumbnails.

## 6. "Make it look like this deck": style from a reference

- **Canva link**: the **Canva Connect API** can export a design (PDF, PNG, PPTX…) via an async export job, but it needs the **user to connect Canva via OAuth** (scope `design:content:read`) and access to that design; download URLs expire after 24h. A pasted share link alone is not an API credential, and a public Canva integration has to go through Canva's review.
- **Universal fallback** (works for Canva, Google Slides, Keynote, a website or a screenshot): user uploads a **PDF export or screenshots**, then render 2–3 pages to images (`pdf.js` / `pdftoppm`), then a **vision model** returns a constrained theme JSON (`palette`, `titleFont`/`bodyFont` *category*, weight, case, alignment, density, photo treatment, corner radius). Palette can be cross-checked with a simple k-means on pixels.
- **Fonts ("font like Airbnb's")**: map to **licensed, free alternatives** (Google Fonts / Fontsource, e.g. a rounded or geometric sans) by category and metrics. **Legal caveat**: brand typefaces such as Airbnb Cereal are proprietary; don't embed, scrape or redistribute them. Say "inspired by" and use an open-licence font (as the prototype's bot does). Same for logos and brand imagery: style inspiration only, never copying assets.

## 7. Voice input (the app is speech-first)

- **MVP**: browser **Web Speech API** for quick dictation (what the prototype tries first; support varies by browser).
- **Production**: send audio to a hosted STT, e.g. **OpenAI** (`gpt-4o-transcribe` / Whisper), **Deepgram**, or **AssemblyAI** (all offer streaming). You likely already capture audio for practice feedback, so reuse that pipeline and the same vendor.
- **Fully conversational option**: **OpenAI Realtime API** (speech-to-speech with tool calls) so the user talks and the bot answers out loud while emitting the same JSON patches. Do this after the text flow works.

## 8. Backend, storage, export

- **API**: your existing backend, or Next.js route handlers / a small Node (Hono/Fastify) service. Endpoints: `POST /decks`, `POST /decks/:id/turn` (streams chat + patches), `POST /decks/:id/approve`, `POST /decks/:id/export`.
- **Data**: Postgres (e.g. **Supabase** or Neon) with `decks`, `deck_versions` (JSONB snapshot per approve), `deck_events` (patch log). Assets in object storage.
- **Jobs**: image generation, Canva/PDF ingestion and exports as background jobs (e.g. **Inngest**, **Trigger.dev**, or a plain queue).
- **Export**:
  - **PPTX**: **PptxGenJS** from the same JSON (charts can be native PPTX charts or embedded SVG/PNG).
  - **PDF**: headless Chromium (**Playwright/Puppeteer**) printing the HTML renderer, which gives pixel parity with the app.
  - **Google Slides**: **Google Slides API** `presentations.batchUpdate` (createSlide, insertText, createImage…), requires Google OAuth.
  - Keep "practice" independent of export: the practice flow reads the JSON directly (as the prototype does with `practiceSlides`).

## 9. Cost and latency (rough, all estimates, check current vendor pricing)

- **Text generation** is the cheap part: v1 and v2 are one structured call each over a small context, and per-turn edits are tiny. Expect a few seconds per generation if you stream results (estimate).
- **Image generation** is the main per-deck cost and latency driver (several seconds per image, estimate). Generate lazily, only for slides that need a photo, and cache.
- **Vision style extraction**: a couple of page images per reference; one-off per deck.
- **STT**: billed per audio minute; small next to practice-session audio you already process.
- UX trick from the prototype: show the structure immediately as text and stream visuals and photos in progressively, so it never feels like waiting.

## 10. Phased plan

1. **MVP (structure only).** Brief chat, then v1 titles and key messages, reorder + inline edit, approve, then a plain-themed deck feeds straight into practice (speaker notes become the ideal text). Text + Web Speech dictation. One LLM provider via the Vercel AI SDK.
2. **Visuals.** Pass 2 with Vega-Lite charts, Mermaid/custom SVG diagrams, and Lucide icons; "why" captured per visual; remove/swap by chat.
3. **Style.** 4–6 curated theme presets, accent/font allow-lists, stock photos, then generated photos and partial animation; PDF + PPTX export.
4. **Reference styles and voice.** PDF/screenshot style extraction with a vision model, then optional Canva Connect OAuth import; streaming STT; Realtime voice mode.
5. **Close the loop.** Use practice feedback (pace per slide, where they stumble) to suggest deck edits: "slide 4 always runs 40s over, split it?"

## 11. Animations and app logic (iteration 2)

The UI is now just a chat thread with one composer (mic, text field, send), so every action is an *intent* in a message. All the stability comes from the app logic, and all the "feel" comes from motion. Versions below were checked on npm on 16 Nov 2026.

### 11.1 UI animations (the builder itself)

| What moves | Use | Why / notes |
|---|---|---|
| Slide reorder (drag, tap-to-place, or "move slide 5 to 2" by voice) | **Motion** for React (`motion`, v14.x, import from `motion/react`): put `layout` + `layoutId={slide.id}` on each card | Motion's layout animations are FLIP under the hood. Every reorder source, whether drag, tap or a chat command, only changes the array; the cards glide to their new places on their own. The prototype does the same by hand: it measures, re-renders, then plays a WAAPI `translateY`. |
| Drag itself | **dnd-kit**: `@dnd-kit/core` + `@dnd-kit/sortable` (stable 6.x), or the newer `@dnd-kit/react` (0.x, pre-1.0) | Pointer, touch and keyboard sensors, plus screen-reader announcements. Keep tap-to-place as the mobile/accessibility fallback. On drop, hand the final order to the store and let Motion animate the settle. |
| New version of a slide (v2.1 → v2.2, theme change, chart swap) | Motion `AnimatePresence` with `mode="popLayout"`, keyed by `slide.id + version`. Cross-fade with a small scale and blur (about 500 ms) | This is the "morph". The prototype layers the old slide as a ghost and fades it out while the new one fades and un-blurs in. |
| Bigger state changes (open the deck viewer, structure → visuals board) | **View Transitions API** (`document.startViewTransition`, with `view-transition-name: slide-<id>` on slide elements) | Same-document view transitions have been Baseline since Firefox 144 (14 Oct 2025); Chrome and Safari had them earlier. That lets a thumbnail in the chat grow into the full-screen viewer with almost no code. Firefox's first implementation lacks transition *types*. Feature-detect, and fall back to a plain fade. |
| Messages appearing, staggered board items | CSS keyframes (opacity + 10 px rise, ~500 ms, `cubic-bezier(.2,.8,.2,1)`), staggered 55 ms per item | Cheap, no JS. Only animate messages the user hasn't seen yet. Re-renders must not replay them, which the prototype handles with a `seen` set of message ids. |
| Streaming text | Append tokens; no per-token animation | Animating every token feels jittery. |
| Accessibility | `prefers-reduced-motion`: Motion's `useReducedMotion()` / `MotionConfig reducedMotion="user"`, plus a CSS media query | The prototype disables all FLIP, morph and entry animations under reduced motion. |

### 11.2 Slide-level animations in the generated decks

The deck JSON gets an `animation` field per element: `{ "preset": "rise" | "fade" | "build-bullets" | "draw-chart" | "none", "order": 1, "delayMs": 0 }`. The model chooses from presets and never writes CSS or JS.

- **In the app (HTML renderer):** map presets to CSS keyframes or the Web Animations API (`element.animate`). Line charts "draw" via `stroke-dasharray`/`stroke-dashoffset`, bars grow with `scaleY`, and bullets build with staggered delays. This is what the prototype does for "animate it". It costs nothing extra and works in the recording screen too.
- **GSAP**, if you want timelines, SplitText-style title reveals, or MorphSVG for chart morphs. **Licensing as of today:** since Webflow acquired GreenSock, GSAP (current npm version 3.15.x) is **free for commercial use, including the formerly paid Club plugins** (SplitText, MorphSVG, ScrollSmoother…). This is under the "Standard No Charge" license (effective 30 Apr 2025, last modified 30 May 2025 per gsap.com/community/standard-license). It is **not open source/MIT**, and there is one restriction: you may not use it in a tool that lets users build visual animations without code *in competition with Webflow's visual animation builder*. Picking presets in a deck generator is very likely fine, but a full no-code animation timeline editor could come close to that line. Read the license and ask Webflow before shipping such a feature. With CSS/WAAPI covering the presets above, GSAP is optional.
- **PPTX export limits:** upstream **PptxGenJS** (v4.0.1) supports **neither slide transitions nor object animations**. A large PR adding them (#1431) is still open. There are community forks: **@ejsink/pptxgenjs** adds slide transitions only, and **pptxgenjs-plus** (lofcz) is described in that PR thread as having the animation work. That claim isn't verified here, so test it before relying on it. Expect PowerPoint to honour the effects, Keynote/LibreOffice to only partly support them, and Google Slides import to drop or alter many of them. The **Google Slides API has no endpoints for animations or transitions** at all (a long-standing feature request was closed as obsolete). Practical rule: animations are guaranteed in the in-app player and the HTML/PDF-as-video export. For PPTX, export static slides plus at most fade transitions from a fork, and say so in the UI.

### 11.3 App logic

**1. A deck state machine for the three passes.** The states are `brief → structure → visualsAsk → visuals → style → final`, with a `busy` (generating) substate, plus `viewer` as a parallel state.
- Use **XState v5** (`xstate` 5.33.x) if you want guards ("can only approve when the deck validates"), visualized charts and testable transitions, or `@xstate/store` for something lighter.
- A plain `useReducer` with a discriminated-union state also works for v1; the prototype is effectively that, with `deck.phase`.
- The machine decides which intents are valid in each state. For example, "add a slide" is refused in the structure pass to keep the timing, and "practice it" only works on a final deck.

**2. Intent parsing: chat to structured edit operations.** Every message goes to an LLM with **tool/function calling**. The tool list depends on the current state:
- `approve_pass`, `reorder_slide{from,to}`, `edit_text{slideId,field,value}`
- `add_visual{slideId,type,why,data}`, `remove_visual`, `set_theme{preset|reference}`, `set_style{accent,font,scale,…}`
- `add_photo{slideId,source}`, `set_animation{…}`, `open_viewer`, `start_practice`, `ask_clarifying_question{text}`

Each tool's arguments are a **Zod** schema (`zod` v4), and the same schema validates the model's output server-side before anything touches the deck. Use the **Vercel AI SDK** (`ai`, v7) `tool()` + `streamText`/`generateObject`, or the providers' native tools / structured outputs.

The model returns *operations*, never a rewritten deck. Two classes of input bypass the LLM:
- Deterministic shortcuts go through a tiny local matcher first, so they are instant and free: "looks good", "next", "slide 4", "back", "practice it". The prototype's matcher is strict and full-message, so "ok, make it green" is an edit, not an approval.
- Taps and drags call the same operations directly.

**3. Patch-based edits, versioning, undo.** Each operation compiles to **JSON Patch (RFC 6902)** against the deck JSON:
- Use `fast-json-patch` (stable, 3.1.x) to apply and validate patches.
- Or keep state in **Immer** (v11) with `enablePatches()`, so `produceWithPatches` gives you patches *and inverse patches* for undo for free.

Store them as an append-only event log `(deckId, version, pass, ops[], inverseOps[], author: user|ai, messageId)`, which gives you:
- Minor versions (v1.3) are just log positions, and an approved pass is a snapshot (v1 → v2 → v3).
- "Undo that" means applying the inverse patch.
- "Go back to v2.1" means replaying up to that point.
- The diff that drives the morph animation is simply "which slide ids did this patch touch".

**4. Streaming updates.** Stream over **SSE** (or the AI SDK's data stream): first the assistant's text, then each validated patch as soon as it's ready.
- The client applies patches optimistically and Motion animates each one in.
- For full generation (v1 structure, v2 visuals), stream slide by slide (`streamObject` with partial objects), so cards appear one at a time instead of after a 10-second spinner.
- If a patch fails validation, the server sends a short correction message instead of the patch; the user never sees a broken deck.

**Recommended combination:**
- Motion (layout + AnimatePresence) and dnd-kit for the builder, with View Transitions for opening/closing the viewer.
- CSS/WAAPI presets for in-deck animation, GSAP optional.
- A small XState machine (or reducer) per deck.
- LLM tool calling with Zod-validated operations.
- Immer/JSON Patch event log for versions and undo.
- SSE streaming.

## 12. Voice loop, undo and honest visuals (iteration 3)

The reference flow is Gamma's Agent; see `research/speech-to-presentation-research.md`.

- **Voice input** is the Web Speech API (`SpeechRecognition` with `continuous` and `interimResults`) in the prototype.
  - In production, use a streaming ASR so the transcript is live and accurate in every browser: Deepgram, AssemblyAI or OpenAI Realtime. Pick on price and latency; these are vendor options to evaluate, not benchmarked here.
  - Gestures: tap = dictate (review, then send); hold = push-to-talk (release sends, slide away cancels).
  - Starting to talk cancels any running agent step (barge-in) through a run token, the same pattern you'd use with an AbortController on a streaming LLM call.
- **Voice output:** a short spoken confirmation after spoken turns via `speechSynthesis`; production could use a TTS API. "Be quiet" mutes it.
- **One intent router** handles typed text, voice, tapped phrases and taps on slides. Production: an LLM with tool calls (`move_slide`, `set_visual`, `restyle`, `undo`, `restore_version`…) over the same deck JSON.
- **Undo / versions:** before every mutation the deck JSON is snapshotted under its version tag, so undo pops the stack, "restore v1.2" jumps to a tag, and passes can be reopened. Production: store JSON patches per version in Postgres.
- **Honest visuals rule:** a visual is auto-suggested only when it can be filled from the user's own content. Otherwise it gets a visible "Sample data" / "Sample quote" tag, or the slide stays a clean statement.
- **Slides** are one JSON → HTML renderer sized in container-query units, so thumbnails, the board and the viewer share the same markup. There are 12 layouts, each with up to 3 variants, and 6 themes. Fonts are Inter, Fraunces, Nunito and Space Grotesk (all OFL).

## What's in the prototype vs. real

| Prototype | Real build |
|---|---|
| Keyword rules pick the deck template, parse "move slide 5 to 2", map "Steve Jobs" to a theme | LLM with structured output + code-side validation and patch application |
| Hand-drawn SVG charts/diagrams with sample data | Vega-Lite / Mermaid specs filled from the user's numbers |
| Gradient "AI photo" placeholders | Stock or generated images, stored with attribution |
| Canva link reply is simulated | Canva Connect OAuth export, or PDF/screenshot + vision model |
| Web Speech API when available, otherwise a simulated take | Streaming STT (and later the Realtime API) |
| State in memory, lost on reload | Postgres versions + event log |
| Hand-written FLIP (measure → re-render → WAAPI) and ghost-layer cross-fades | Motion `layout` / `AnimatePresence`, View Transitions for the viewer |
| Regex intents (“looks good”, “practice it”, “move slide 5 to 2”) | Local shortcut matcher + LLM tool calling with Zod-validated operations |
| Version numbers are counters | JSON Patch event log with inverse patches (undo, restore any version) |
