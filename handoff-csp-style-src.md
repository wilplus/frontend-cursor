# Handoff — CSP `style-src` hardening, after the 2026-08-04 outage

**Status:** the outage is fixed by rolling #242 back. The *hardening it was
trying to do is still worth doing* — this document is what the next attempt
needs to know so it does not repeat the same failure.

**Branch carrying the rollback:** `claude/prayer-title-undefined-gmzu6m`
**Reverted:** #242 "Split style-src so injected `<style>` blocks are blocked"

---

## 1. What happened

`#242` replaced

```
style-src 'self' 'unsafe-inline'
```

with

```
style-src      'self' 'unsafe-inline'   ← CSP2 fallback
style-src-elem 'self'                   ← the tightening
style-src-attr 'unsafe-inline'
```

Every route then rendered the app's error boundary — "Something went wrong" —
**on all states**, signed in and out alike.

Safari console, in the order it appeared:

```
Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline'
  does not appear in the style-src directive of the CSP              chat:1
TypeError: a[e] is not a function (In 'a[e](n,n.exports,s)',
  'a[e]' is undefined)                                          webpack….js
```

## 2. The mechanism, precisely

`style-src-elem 'self'` forbids **inline `<style>` elements**. It overrides the
`style-src` fallback in every browser that understands it, so the CSP2 line
underneath does not soften it.

**`sonner` — the toast library — injects its stylesheet as an inline `<style>`
element when the toaster first mounts.** That is the blocked stylesheet.

The failure did not stop at "toasts look wrong":

1. Safari refuses the `<style>` insertion.
2. webpack's chunk-load promise rejects along with it.
3. The rejection surfaces from the module registry as
   `a[e] is not a function` — `a[e]` being an absent module factory.
4. React's error boundary catches it → "Something went wrong".

Because the toaster is mounted app-wide, this fired on every route.

**Chrome is more forgiving than Safari here**, which is why it read as an
iOS-only fault and why desktop checks looked clean.

## 3. Why the original verification could not have caught it

#242's premise was:

> "The app ships zero `<style>` tags and loads CSS only from
> `/_next/static/css` — verified across `/`, `/login`, `/blog`, `/about`
> and `/chat`."

**That statement is true, and it is not sufficient.** Confirmed independently:
the production build emits **zero** `<style>` tags in its rendered HTML.

The block does not exist in the markup. It does not exist in our source. It is
written by a dependency at runtime, after a component mounts. No amount of
inspecting pages, grepping the repo, or reading build output can find it.

**This is the transferable lesson: a `style-src` audit must be done against a
LIVE, INTERACTED-WITH page in a browser that enforces the directive — not
against markup, source, or build artefacts.**

## 4. Current state of the policy

Live in `src/middleware.ts` → `getCspDirectives()`:

| Directive | Value | Note |
|---|---|---|
| `style-src` | `'self' 'unsafe-inline'` | rolled back to pre-#242 |
| `style-src-elem` | *(absent)* | removed — this is the one that broke it |
| `style-src-attr` | *(absent)* | removed with the split |
| `script-src` | `'self' 'nonce-…'` | **untouched**, no `'unsafe-inline'` |
| `connect-src` | + `wss://*.supabase.co`, `wss://*.supabase.io` | see §6 |

The rollback **loosens styles only**. Script, `frame-ancestors`, `object-src`,
`base-uri` and `worker-src` are exactly as they were.

## 5. The actual task — re-landing the hardening

The security argument in #242 is sound: one injected `<style>` block can carry
attribute-selector rules that exfiltrate values a character at a time. Closing
it is worth doing. It just has to account for sonner first.

Three routes, best first:

### Option A — pull sonner's CSS into the bundle *(recommended)*

Import sonner's stylesheet through the app so it is emitted as a normal file
under `/_next/static/css` and covered by `'self'`. Then `style-src-elem 'self'`
is safe with no hash to maintain.

- sonner ships `sonner/dist/styles.css`; importing it does not by itself stop
  the runtime injection, so **verify in a browser** that no `<style>` element
  is written once the toaster mounts. If the library still injects
  unconditionally, this option is out — go to B.
- Cheapest to maintain if it works: nothing to update when sonner is bumped.

### Option B — hash the injected block

Add `'sha256-…'` for sonner's stylesheet to `style-src-elem`.

- **The hash changes whenever sonner is upgraded**, and the failure mode of a
  stale hash is *this outage again*. Do not take this option without a CI check
  that recomputes the hash from the installed package and fails on drift.

### Option C — replace sonner

Only if A and B both fail, and only on its own merits. Not worth an outage's
worth of risk for a toast library.

**Whichever route: ship it behind `Content-Security-Policy-Report-Only` first**,
collect violations from real traffic for a few days, and promote to enforcing
only when the report is clean. That single step would have prevented this
entirely.

## 6. Separate finding, already fixed — `connect-src` and `wss://`

Not caused by #242; it had been broken for longer.

```
Refused to connect to wss://<project>.supabase.co/realtime/v1/websocket
  because it does not appear in the connect-src directive
Error: WebSocket not available: The operation is insecure.        (x4)
```

`connect-src` listed `https://*.supabase.co` but no `wss://` source. **CSP
scheme-matching treats `https:` and `wss:` as distinct — an `https://` source
does not authorise a WebSocket.** Supabase Realtime therefore could never
connect under an enforcing browser.

Chrome is lenient about this; Safari is not. So realtime looked fine on desktop
and was dead on iOS.

Fixed by adding `wss://*.supabase.co` and `wss://*.supabase.io`, plus the exact
`wss://` host derived from `NEXT_PUBLIC_SUPABASE_URL` for a custom domain.

**Watch for the same class elsewhere:** any future WebSocket origin needs its
own `wss://` entry even when the `https://` origin is already listed.

## 7. The guard that now exists

`src/lib/security/csp.test.ts` — `getCspDirectives` is exported for it.

Seven assertions, framed around **what must remain ALLOWED**, because a CSP
fails closed and every failure is something a user cannot load:

- `connect-src` carries `wss://*.supabase.co`, not only the https origin
- `style-src` still permits the runtime-injected block
- **if `style-src-elem` is present at all, it must include `'unsafe-inline'`** —
  this is the tripwire; a re-land using a hash or bundled CSS will need to
  update that assertion deliberately, which is the point
- `script-src` keeps the nonce and never gains `'unsafe-inline'`
- `frame-ancestors` / `object-src` / `base-uri` clamps intact
- the header is well-formed with no empty directives

Mutation-checked: reintroducing `style-src-elem 'self'` and removing the
`wss://` wildcard each fail the suite.

**When you re-land the hardening, the third assertion is meant to fail.**
Changing it is the moment to confirm you have Option A or B genuinely working,
not a reason to delete the test.

## 8. Also on this branch (unrelated, do not conflate)

`public/sw.js` — the service worker install could fail outright. `cache.addAll`
is atomic and `cache.put` rejects a redirected response; all three precached
shell assets pass through the middleware, which redirects. A failed install
means the worker never activates, so browsers stay pinned to the worker they
already have, permanently, through every deploy.

That is a real defect and it blocks recovery from *any* bad deploy — but it is
**not** what caused this outage (private browsing, which has no service worker,
was equally broken). Reviewable independently of the CSP work.

## 9. Open question, still unanswered

The original 2026-08-04 crash (`VIEWS.prayer.title` undefined) was a
build-to-browser skew that was never explained: `main` defined the key and read
it in the same commit. It is guarded now (`viewTitle()` degrades to a fallback)
rather than understood.

The `a[e] is not a function` in this incident is a *different* cause — the CSP
chain above — but it is the same **shape**: a module registry entry missing at
runtime. If that shape shows up a third time without a CSP violation next to
it, the build-to-browser skew is the thread to pull.
