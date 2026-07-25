# FE PROMPT — Public Journal (blog) + admin CMS

**Repo:** `frontend-cursor` (Next.js App Router, TypeScript, Tailwind, deployed at www.willpowerlab.com)
**Status:** spec only until approved. Backend contract is in `docs/journal-be-prompt.md`.

---

## 0. Context you need before writing code

- The app is **Next.js App Router**. `/` currently **redirects to `/chat`** — there is no marketing landing. **Do not change this.**
- Public marketing pages (`/about`, `/science`) are **server components** exporting SEO `metadata`, and the site uses shared `src/components/SiteHeader.tsx` + `src/components/Footer.tsx`. **Read those two files and `/about` first** and compose the Journal the same way (SiteHeader is a sticky `h-14` client component; Footer expects the parent layout's `flex flex-col h-[100dvh]` + `flex-1 overflow-y-auto` chrome).
- Backend calls normally go through the **auth-required BFF** (`src/lib/api/bff.ts` — `proxyJson`/`proxyMultipart` return **401 without a Supabase session**). Therefore:
  - **Public Journal reads must NOT use that proxy.** Server-render (ISR) directly from the public backend endpoints.
  - **CMS calls** use unauthenticated same-origin passthrough routes that forward an admin password in the body (see §4).
- Design tokens live in `src/app/globals.css` (HSL) and are mapped in `tailwind.config.ts`.

### Design port rules (do NOT copy the designer's Lovable CSS verbatim)

The designer's mock is a separate Vite app using `oklch` values and a static `blog-data.ts`. Its token **names** match ours but the **values do not**. Port it as follows:

- Use **semantic Tailwind classes only**: `bg-background text-foreground text-muted-foreground border-border bg-muted`.
- The palette is **pure white / near-black**. **`primary` (orange) is reserved for live-action signals only — never use it anywhere in the Journal or CMS.**
- Keep **one neutral warm off-white** for audio panels: add a token to `globals.css` (e.g. `--journal-media: 40 30% 97%`) or reuse `bg-muted`. **Drop the mock's amber ring accent** — use `border-border` / `ring-foreground/10`.
- Fonts: the app retired DM Serif — use the **system stack**. The mock's "font-serif" body is a look, not a font dependency; render body copy in the system stack at the given size/leading.
- **No em-dashes in any UI copy** (founder rule). Use commas or periods.
- Admin **status pills keep semantic emerald/amber** — they signal state in an internal tool, not brand.

---

## 1. Routes & shell

Create `src/app/journal/layout.tsx` — public shell: `SiteHeader` + content + `Footer`, matching how `/about` and `/science` compose theirs.

Add nav links:
- `SiteHeader` menu: **"Journal" → `/journal`**, **"The lab" → `/chat`** (keep Logo → `/`, and existing Home/About/Science).
- `Footer`: add **"Journal" → `/journal`**.

### `/journal` — index (server component)

- `export const revalidate = 300` (ISR). Fetch published posts **server-side** from the public backend `GET /v2/journal/posts`. Do not call the authed BFF.
- Export `metadata` (title "Journal | WillpowerLab", description, `alternates.canonical`, OpenGraph) — mirror `src/app/about/page.tsx`.
- Pass the fetched list to a **client** child component that owns search / category / sort state.

### `/journal/[slug]` — post (server component)

- ISR + `generateStaticParams()` from published slugs + `generateMetadata()` (title, description = excerpt, OG image = cover).
- `notFound()` when the slug is missing or the post is a draft.

---

## 2. Index UI

**No hero** (founder decision) — the page opens search-first, matching the mock.

**Sticky filter bar:** `sticky top-14 z-20 bg-background/85 backdrop-blur border-y border-border/70`
- Left: search input — `rounded-full border border-border bg-background pl-10 pr-4 py-2.5 text-sm`, lucide `Search` icon `absolute left-3`, `focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10`. Placeholder: `Search by title...`
- Right: Sort `<select>` — **Newest, Oldest, Curated** ("Curated" orders by the CMS `sort_order`).

**Category chips:** All · Physiology · Physical Exercise · Philosophy · Voice · Language · Others
- inactive: `border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground`
- active: `bg-foreground text-background border-foreground`
- shape: `rounded-full px-4 py-2 text-sm`

Search / filter / sort run **in memory** over the fetched list (instant, no refetch). Add pagination only if the list outgrows one page.

**Grid:** `max-w-5xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14`

**Card** (whole card links to `/journal/[slug]`, `group`):
- Cover: `aspect-[4/3] rounded-2xl overflow-hidden bg-muted`; image `object-cover w-full h-full group-hover:scale-[1.03] transition duration-500`; always set `alt` from `cover_alt`.
- Media badge (video/audio only), bottom-left: `absolute bottom-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] shadow-sm` + lucide `Play` / `Volume2` (12px) + label `Video` or `Audio · 3:12`.
- **Audio-only cover** (no image): warm off-white panel + decorative `<Waveform/>` of 40 bars (`w-[3px] bg-foreground/60`, varied heights), `aria-hidden`.
- Eyebrow: `text-[11px] uppercase tracking-[0.14em] text-muted-foreground` → `CATEGORY · N MIN READ`
- Title: `text-lg font-semibold tracking-tight group-hover:underline underline-offset-4`
- Excerpt: `text-sm text-muted-foreground line-clamp-2`

---

## 3. Post UI

- Reading column `max-w-2xl mx-auto px-6`; cover slightly wider at `max-w-3xl mx-auto px-6`.
- Back link: `← JOURNAL` → `/journal`, `text-xs uppercase tracking-[0.14em] text-muted-foreground`, lucide `ArrowLeft` 3.5×3.5.
- Meta row: `text-[11px] uppercase tracking-[0.14em] text-muted-foreground` → `CATEGORY · N MIN READ · 18 JULY 2026` (dot separators).
- Title `text-3xl sm:text-5xl font-semibold tracking-tight leading-tight`; excerpt `text-lg leading-relaxed text-muted-foreground`.
- Author row: 9×9 `rounded-full bg-foreground text-background` with the initial, plus `author_name`.
- **Cover by kind** (`rounded-3xl`, wider than card radius):
  - `image` → `next/image` (or `img`) in `rounded-3xl overflow-hidden bg-muted`
  - `video` → `<video controls poster={cover_image_url}>` inside `rounded-3xl bg-muted`
  - `audio` → warm off-white panel: eyebrow `AUDIO RECORDING · mm:ss` (lucide `Volume2`) + `<audio controls className="w-full">`
- **Body rendering — important:** the body is **plain text**; paragraphs are separated by **blank lines**. Split on `/\n\s*\n/`, trim, and render each chunk as a `<p>`. **Never use `dangerouslySetInnerHTML`** — there is no HTML in the body, so there is no XSS surface. Container `space-y-6`; paragraph `text-[17px] leading-[1.75] text-foreground/90`.
- Divider between body and related: `<hr className="border-border my-14">`.
- Related: `border-t border-border/70`, eyebrow, up to 3 same-category posts reusing the index card component.
- Post footer: `← All posts` (left) and `Filed in <Category>` (right).

---

## 4. CMS — `/admin/journal`

**Auth = the existing backend-password pattern, NOT a user role.** Read `src/app/admin/credits/page.tsx` first and copy its approach:
- The page is **not** under `(protected)`, has **no** Supabase role gate, and is **not linked in any nav** (URL only).
- It holds an admin password in component state (optionally `sessionStorage`, **never** `localStorage`) and sends it **in the body of every request**.
- Requests go to same-origin passthrough routes under `src/app/api/v2/internal/journal/*` that forward the body (password included) to the backend **without** requiring a Supabase session — model these on the existing `/api/v2/internal/student-credits/*` routes that `/admin/credits` already calls. **Confirm that existing route's file location and copy its shape.**
- Handle `401` → "Wrong password." and `503` → "Admin password is not configured on the server."

**Layout** (from the mock): page `bg-muted`-ish canvas (use tokens, not `#f5f5f4`), sticky top bar `bg-background/85 backdrop-blur border-b`, container `max-w-6xl mx-auto px-6`, two-pane `lg:grid-cols-[1fr_1.4fr] gap-6`, panels `rounded-2xl border border-border bg-background`.

**Top bar:** `← JOURNAL` + `CMS` title, right side `Reset` (ghost) + `+ New draft` (primary).

**Left pane — POSTS · N**
- `divide-y divide-border`; row `px-4 py-3`; active row `bg-muted/60`.
- Row content: status pill + category eyebrow + media tag (`text-[10px] uppercase tracking-[0.14em]`), then title `text-sm font-medium truncate`.
- Controls: ↑/↓ reorder (lucide arrows 3.5×3.5, vertical stack) → persists `sort_order`; eye = preview; trash = delete (confirm first).
- Status pills: Published `bg-emerald-100 text-emerald-800`, Draft `bg-amber-100 text-amber-800`, both `rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider`.

**Right pane — editor.** Header: status pill + Publish/Unpublish toggle (left), Close + Save (right). Fields **in this exact order**:

1. **Cover media** — chips `Image | Video | Audio` (active `bg-foreground text-background`, same chip pattern as index filters); preview `aspect-[4/3] rounded-2xl bg-muted` with an empty state ("No image yet"); an input accepting a **pasted URL** *or* an **Upload** button; then **Alt text** input.
2. **Title** — `text-base font-semibold tracking-tight`
3. **Slug (URL)** — prefix label `/journal/` + input + **"from title"** button (slugify). New drafts default to `draft-<random>`. Validate url-safe + uniqueness (surface the backend's 409).
4. **Category** (select) and **Author** (text, default `Willpower Lab`) — side by side
5. **Published date** (date input, manual) and **Read minutes** (number input, manual) — side by side
6. **Excerpt** (textarea)
7. **Body** — textarea, label `BODY, SEPARATE PARAGRAPHS WITH A BLANK LINE`, styled `text-[15px] leading-[1.75]`

Field styling: label `text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5`; input `rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-foreground/30` (no ring — minimal). Buttons: primary `rounded-full bg-foreground text-background px-3.5 py-1.5 text-xs`; ghost `rounded-full border border-border bg-background text-muted-foreground`; icon `rounded-lg border border-border p-2`.

**Two semantics to implement as specified:**
- **Published date = display date** (shown on the card/post, drives Newest/Oldest). **Publish/Unpublish toggle = visibility** (whether it appears publicly). They are independent, so a post can be backdated.
- **Body is plain text.** No rich-text editor, no inline media, no HTML.

**Media upload = presigned direct-to-storage.** Ask the backend for a presigned URL (`POST /v2/internal/journal/media/presign`), `PUT` the file **straight to storage from the browser**, then save the returned public URL on the post. **Never stream video through the BFF** — Vercel's ~4.5MB serverless body limit will 413 it (the app already hit this on audio uploads). A pasted external URL skips this entirely.

**Do NOT port the mock's demo persistence:** ignore its `localStorage` key `willpower.blog.v1`, its `blog-data.ts` seed, and its FileReader/data-URL uploads. All state lives in the backend.

**Preview:** the eye icon opens the real public post renderer with the current draft values (a `?preview` route or a modal reusing the post component), so what you see is what publishes.

---

## 5. Acceptance

- `/journal` renders published posts; search, all 6 categories + All, and the three sorts work; cards link correctly; video/audio badges show.
- `/journal/[slug]` renders image/video/audio covers with working playback; body paragraphs split on blank lines; related posts and the footer render; drafts 404.
- SEO metadata + OG tags present on both; ISR revalidates.
- `/admin/journal` (password) can create, edit, save, publish, unpublish, delete, reorder, and upload a cover; nothing there is reachable without the password.
- Nothing uses `primary`/orange. Nothing uses `dangerouslySetInnerHTML`. No em-dashes in UI copy.
- Responsive: 1 / 2 / 3 column grid; the CMS collapses to one column below `lg`.

**Verify before handing back:** run `npx next build` (catches Next-specific errors that `tsc` and vitest miss). Note: local builds currently fail on `pdfjs-dist` / `@react-email` — those exist on Vercel, so ignore **only** those two. Run tests with `npx vitest run --dir src`.
