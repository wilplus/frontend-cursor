# Domain migration: `willonski.com` → `willpowerlab.com`

Canonical web/app domain is now **`https://www.willpowerlab.com`** (**`www` is canonical**). The apex `willpowerlab.com` 308-redirects to `www`. (Apex-as-canonical was dropped: GoDaddy domain-forwarding kept locking conflicting apex A records — `www` is a CNAME that auto-follows Vercel and is far more robust.)

**Rules**
- Web/app URLs → `https://www.willpowerlab.com` (with `www`).
- **Email addresses stay `@willonski.com`** (e.g. `artur@willonski.com`). The email *sending* domain does NOT change — keep `willonski.com` DNS (SPF/DKIM/MX) intact.
- Product display name is **"WillpowerLab"** (renamed from "Willab" on `origin/main` in the brand commit `152c14b`); the company/domain is WillpowerLab too.
- Keep old hosts (`willonski.com`, `app.willonski.com`) alive as **301 redirects** to `www.willpowerlab.com` so links in already-sent emails keep working.

---

## 1. Repo / code  ✅ DONE on branch `claude/willpowerlab-domain-seo-about`
- [x] Email template URLs swapped to `www` — `PostSessionResultsEmail.tsx`, `postSessionResultsText.ts`, `StudentCompletionEmail.tsx`, `CoachEmail.tsx`, `CoachCompletionEmail.tsx`
- [x] SEO: `metadataBase`, OpenGraph, Twitter in `src/app/layout.tsx` (→ `www`)
- [x] `src/app/robots.ts` + `src/app/sitemap.ts` (→ `www`)
- [x] Footer → About + Science only
- [x] New `src/app/about/page.tsx`
- [x] Email addresses left as `@willonski.com` (intentional)

**No change needed (host-relative, auto-follows domain):** `src/app/manifest.ts`, `public/sw.js`, `src/app/auth/callback/route.ts`, `/icon`, `/willab-logo`.

**Optional:** add an in-app 301 from old host in `next.config.mjs` (only fires if old domain points at this Vercel app).

---

## 2. Vercel — frontend project
**Settings → Domains** (current state is already correct for `www`-canonical)
- [x] `www.willpowerlab.com` → **Production** (primary, serves the app) — already green
- [x] `willpowerlab.com` (apex) → **Redirect to** `www.willpowerlab.com` (308) — already set; just needs valid DNS (see §3)
- [ ] (Optional) Move `willonski.com` / `app.willonski.com` here as **Redirect to** `www.willpowerlab.com`, OR handle the redirect at the registrar.

**Settings → Environment Variables** (Production + Preview)
- [ ] `NEXT_PUBLIC_SITE_URL = https://www.willpowerlab.com`  ← drives Stripe success/cancel URLs
- [ ] Leave `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_BACKEND_URL` / `NEXT_PUBLIC_SUPABASE_URL` **unchanged** (those are the backend/Supabase, not this rename).
- [ ] **Redeploy** after editing env (env changes don't apply to existing builds).

---

## 3. DNS — at GoDaddy (for `willpowerlab.com`)
- [x] `www` `CNAME` → `ccaf4db8749bc594.vercel-dns-017.com.` — already valid (this is the canonical host).
- [ ] **Fix the apex so its redirect resolves:** GoDaddy → Domain Settings → **Forwarding → remove/disable** the forward on `willpowerlab.com`. That unlocks and removes the two conflicting A records (`15.197.225.128`, `3.33.251.168`).
- [ ] Leave **exactly one** apex record: `A  @ → 216.198.79.1` (the value Vercel's DNS Records tab asks for). Do **not** use the "Vercel DNS" / nameserver tab — that hands all DNS to Vercel.
- [ ] In Vercel → apex → **DNS Records** tab → **Refresh** until "Valid Configuration".

**Old domain `willonski.com`:**
- [ ] Keep it resolving; point it at Vercel as a redirect (step 2) **or** add a registrar 301 → `https://www.willpowerlab.com`.
- [ ] **Do NOT remove email DNS** (MX / SPF / DKIM / DMARC) on `willonski.com` — email stays on that domain.

---

## 4. Supabase — Auth
**Dashboard → Authentication → URL Configuration**
- [ ] **Site URL** → `https://www.willpowerlab.com`
- [ ] **Redirect URLs** allow-list — add:
  - `https://www.willpowerlab.com/**`
  - `https://www.willpowerlab.com/auth/callback`
  - `https://www.willpowerlab.com/auth/oauth-complete`
  - `https://www.willpowerlab.com/update-password`
  - (keep `http://localhost:3000/**` for local dev)
- [ ] **Email templates** (Confirm / Magic Link / Reset / Invite): if any link is hardcoded, switch to `{{ .SiteURL }}`. Updating Site URL above fixes templates that already use it.
- [ ] **Storage → CORS** (only if you upload directly to Supabase Storage from the browser): add `https://www.willpowerlab.com`.

**Without this, login / OAuth / password reset will redirect-error after cutover.**

---

## 5. Backend (Railway) — env vars
**Railway → your backend service → Variables**
- [ ] `FRONTEND_URL = https://www.willpowerlab.com`  (single value, with `https://`, no trailing slash)
- [ ] `CORS_ORIGINS` → add `https://www.willpowerlab.com`. Keep `http://localhost:3000` for dev. You may keep `https://app.willonski.com` during transition, then remove.
- [ ] Any other backend var that builds email/report links from the frontend host.
- [ ] Redeploy the backend.

**Without this, API calls from the new domain get blocked by CORS, and backend-generated email links point to the old domain.**

---

## 6. Stripe
**Dashboard**
- [ ] **Developers → Webhooks**: if an endpoint points to the app domain (e.g. `https://app.willonski.com/api/stripe/webhook`), add/replace with `https://www.willpowerlab.com/...` and update the signing secret in Vercel if it changes.
- [ ] **Settings → Business / Branding**: update business website + any redirect/portal URLs to `willpowerlab.com`.
- [ ] Checkout `success_url`/`cancel_url` are built at runtime from `NEXT_PUBLIC_SITE_URL` — fixed by step 2, no dashboard change.

---

## 7. OAuth providers (Google / LinkedIn)
The login redirect URI usually points at **Supabase** (`https://<project>.supabase.co/auth/v1/callback`) — that does **not** change. But update any app-domain references:
- [ ] **Google Cloud Console → Credentials → OAuth client**: add `https://www.willpowerlab.com` to **Authorized JavaScript origins**; confirm redirect URI (Supabase callback) is present.
- [ ] **Google OAuth consent screen**: update **Authorized domains** / homepage / privacy / terms links to `willpowerlab.com`.
- [ ] **LinkedIn app** (if used for OAuth/share): update authorized redirect URLs + website.

---

## 8. Email deliverability
- [ ] Sender stays `@willonski.com` → **no change** to SendGrid/Resend/SES domain verification. Just confirm `willonski.com` email DNS remains.
- [ ] Links *inside* emails now point to `willpowerlab.com` (done in code) — verify a live test send renders the new links.

---

## 9. Search / analytics / external listings
- [ ] **Google Search Console**: add `willpowerlab.com` property → verify → submit `https://www.willpowerlab.com/sitemap.xml`.
- [ ] If the old domain was indexed: use **Change of Address** (old property → new) and keep the 301s.
- [ ] **Analytics** (GA4 / Plausible / PostHog): add/replace the domain in the property/site settings.
- [ ] Update outbound references: LinkedIn company page website, social bios, app store / landing links, business cards / QR codes, any partner or press links.

---

## 10. Cutover verification (test on the new domain)
- [ ] Home, `/about`, `/science`, `/chat`, `/terms`, `/privacy` load over HTTPS
- [ ] `https://www.willpowerlab.com/robots.txt` + `/sitemap.xml` return 200 with apex URLs
- [ ] Sign up → email confirm link works
- [ ] Log in (password **and** Google/LinkedIn OAuth)
- [ ] Password reset → `/update-password` flow
- [ ] A real Stripe checkout → returns to `https://www.willpowerlab.com/dashboard?credits=success`
- [ ] An admin/report email → links resolve on `willpowerlab.com`
- [ ] No CORS errors in the browser console on API calls
- [ ] Old `willonski.com` link 301-redirects to `willpowerlab.com`

---

### Quick ref — who owns what
| System | What to change | Where |
|---|---|---|
| Frontend code | URLs, SEO, About (done) | this repo |
| `NEXT_PUBLIC_SITE_URL` | `https://www.willpowerlab.com` | Vercel env |
| Custom domain + DNS | add apex, redirect www/old | Vercel + registrar |
| Auth redirects | Site URL + allow-list | Supabase |
| API CORS + email links | `FRONTEND_URL`, `CORS_ORIGINS` | Railway (backend) |
| Payments | webhook + business URL | Stripe |
| Social login | origins / consent domains | Google / LinkedIn |
| Email sending | (unchanged — stays willonski.com) | DNS / ESP |
| Indexing | new property + sitemap + redirect | Search Console / analytics |
