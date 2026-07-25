# BE PROMPT — Journal (blog) content + media API

**Repo:** `backend-cursor` (Flask). Consumed by the `frontend-cursor` Next.js app; the FE spec is in `docs/journal-fe-prompt.md` of that repo.
**Status:** spec only until approved.

---

## 0. What this is

A public **Journal** (blog) on www.willpowerlab.com plus a small in-house **CMS**. You provide:

1. **Public read endpoints — NO auth.** The FE server-renders the Journal with ISR, so these must be reachable without a session or token.
2. **Admin write endpoints — password-gated**, matching the existing internal-tools pattern (see §3).
3. **Presigned media upload** so the browser uploads covers directly to object storage.

Two structural decisions from the founder that keep this small:

- **The post body is PLAIN TEXT**, with paragraphs separated by blank lines. It is **not** HTML and **not** Markdown. The FE splits on blank lines and renders `<p>` elements. **Therefore no HTML sanitization is required** — but you must still reject/strip anything that isn't plain text if you ever change this.
- **`published_at` and `read_time_min` are author-supplied**, set manually in the CMS. Do **not** derive them.

---

## 1. Data model — `journal_post`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text, **unique**, url-safe | `/journal/<slug>`; return **409** on collision |
| `title` | text | |
| `excerpt` | text | shown on cards and as the meta description |
| `category` | enum | `physiology`, `physical_exercise`, `philosophy`, `voice`, `language`, `others` |
| `read_time_min` | int | **manual**, from the CMS |
| `cover_kind` | enum | `image`, `video`, `audio` |
| `cover_image_url` | text, nullable | the image, or the video poster |
| `cover_alt` | text, nullable | accessibility |
| `media_url` | text, nullable | video/audio file when `cover_kind` is video/audio |
| `media_duration_sec` | int, nullable | renders as `Audio · 3:12` |
| `body` | text | **plain text**, blank-line-separated paragraphs |
| `author_name` | text | default `Willpower Lab` |
| `author_avatar_url` | text, nullable | |
| `status` | enum | `draft`, `published` |
| `published_at` | timestamptz, nullable | **display date**, author-set; drives Newest/Oldest |
| `sort_order` | int, default 0 | manual ordering for the `curated` sort |
| `meta_title` / `meta_description` / `og_image_url` | text, nullable | SEO overrides |
| `created_at` / `updated_at` | timestamptz | |

**Indexes:** unique(`slug`); (`status`, `published_at` desc); (`category`); (`sort_order`).

**Note on visibility vs date:** `status` controls whether the post is public; `published_at` is only the displayed date. They are independent — a published post may be backdated, and a draft may already carry a date.

---

## 2. Public endpoints (NO auth)

These must work with no `Authorization` header and no cookie.

### `GET /v2/journal/posts`
Published posts only. Query params:
- `category` — one of the enum values, or omitted/`all`
- `q` — case-insensitive substring over `title` (and optionally `excerpt`)
- `sort` — `newest` (default, `published_at desc`), `oldest`, `curated` (`sort_order asc`, then `published_at desc`)
- `limit` (default 50, max 100), `offset`

Response: `{ posts: [...], total: <int> }`, each item carrying the card fields: `slug, title, excerpt, category, read_time_min, cover_kind, cover_image_url, cover_alt, media_duration_sec, published_at, sort_order`.

### `GET /v2/journal/posts/<slug>`
Full published post (adds `body`, `media_url`, `author_name`, `author_avatar_url`, SEO fields). **404 when the post is missing or a draft.**

### `GET /v2/journal/categories` *(optional)*
Category keys with published counts.

Caching: these are safe to cache at the edge/CDN; the FE also revalidates on a 300s ISR window.

---

## 3. Admin endpoints — password-gated

**Auth model (founder decision): a shared admin password in the request body**, exactly like the existing internal credits tools. **Do not** build a user role for this.

- Reuse the existing admin-password secret, or add a dedicated `JOURNAL_ADMIN_PASSWORD` env var.
- Because the password rides in the **body**, **all admin endpoints (including reads) are `POST`.**
- Namespace: `/v2/internal/journal/*`, matching the existing `/v2/internal/student-credits/*`.
- Error contract, matching the existing tools: **401** `{"error": "Wrong password"}` on mismatch; **503** when the password env var is unset.
- Never log the password. Compare in constant time. Rate-limit these endpoints.

| Endpoint | Body | Purpose |
|---|---|---|
| `POST /v2/internal/journal/posts/list` | `{password}` | all posts incl. drafts, for the CMS list |
| `POST /v2/internal/journal/posts/get` | `{password, id}` | one post for editing |
| `POST /v2/internal/journal/posts/create` | `{password, ...fields}` | new draft; returns the created post |
| `POST /v2/internal/journal/posts/update` | `{password, id, ...fields}` | full update |
| `POST /v2/internal/journal/posts/delete` | `{password, id}` | delete |
| `POST /v2/internal/journal/posts/publish` | `{password, id}` | `status = published`; set `published_at` if still null |
| `POST /v2/internal/journal/posts/unpublish` | `{password, id}` | `status = draft` (keep `published_at`) |
| `POST /v2/internal/journal/reorder` | `{password, ids: [...]}` | assign `sort_order` by array position |
| `POST /v2/internal/journal/media/presign` | `{password, filename, content_type, kind}` | see §4 |

Validation: enum membership for `category`/`cover_kind`; url-safe unique `slug` (**409** with a clear message on collision); sane bounds on `read_time_min`; when `cover_kind` is `video`/`audio`, require `media_url`.

**Accept an external URL too.** The CMS lets the author paste a URL instead of uploading. Accept any `https://` URL for `cover_image_url` / `media_url`; validate the scheme and reject anything that isn't `https`.

---

## 4. Media — presigned direct-to-storage

`POST /v2/internal/journal/media/presign` → `{ upload_url, public_url, fields? , expires_in }`.

The browser `PUT`s the file **directly to storage**; the file never transits Flask or the Next BFF. This is required, not an optimization: the FE is on Vercel, whose serverless request body limit (~4.5MB) already causes 413s on audio uploads, and Journal videos will be far larger.

- Enforce a **content-type allowlist** and per-kind size caps, e.g. image `image/jpeg|png|webp|avif` ≤ 10MB, audio `audio/mpeg|mp4|webm` ≤ 50MB, video `video/mp4|webm` ≤ 500MB (tune to your storage/CDN budget).
- Randomize stored object keys (never trust the client filename); preserve the extension.
- Serve via CDN with long-lived cache headers; objects are public-read.
- Optional niceties: server-side video poster extraction, and audio duration probing (otherwise the FE supplies `media_duration_sec`).

---

## 5. Suggested sequencing

1. **Model + public reads** — the Journal goes live as soon as one post exists (seed a post directly in the DB if useful).
2. **Admin write endpoints + password gate** — unblocks the CMS.
3. **Presigned media** — unblocks cover uploads (external URLs work without it).
4. **Optional:** sitemap feed for the Journal, and an RSS endpoint.

## 6. Acceptance

- Public endpoints return correct data **with no credentials**; drafts are invisible; all three sorts and the category/`q` filters behave.
- `<slug>` 404s for drafts and unknown slugs.
- Every admin endpoint 401s on a wrong password and 503s when unconfigured.
- Slug collisions return 409, not a 500.
- A presigned upload round-trips: presign → direct PUT → the returned `public_url` is publicly fetchable.
- `published_at` and `read_time_min` persist exactly as supplied (never overwritten by derivation).
