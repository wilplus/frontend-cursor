# Rollout: v2 Session Flow

How to ship a v2 session flow and choose where it lives and when it resumes.

---

## 1) Rollout choice — how to do it

### Option (a) New route `/dashboard/v2` (safest)

**Idea:** v1 stays on `/dashboard`; v2 lives on its own route. No change to existing dashboard or SessionCard.

**Steps:**

1. **Add the route**
   - Create `src/app/(protected)/dashboard/v2/page.tsx`.
   - In that page render your v2 shell (e.g. `DashboardShell` or a v2-specific shell) and your v2 session component (e.g. `SessionCardV2` or a new flow component).

2. **Link to v2**
   - From `/dashboard`, add a button or link that goes to `/dashboard/v2` (e.g. “Try new session flow” or “Start v2 session”). Optionally hide it behind a feature flag or show only to certain users.

3. **Resume**
   - v2 resume runs only when the user is on `/dashboard/v2` (e.g. in `SessionCardV2`’s `useEffect` when `authReady` and route is `/dashboard/v2`). See “2) v2 resume” below.

**Files to add:**

- `src/app/(protected)/dashboard/v2/page.tsx` — renders v2 flow.
- (Optional) `src/components/dashboard/SessionCardV2.tsx` — v2 session UI; call v2 initialize/resume only when this component is mounted (i.e. user is on `/dashboard/v2`).

**No changes to:** `src/app/(protected)/dashboard/page.tsx`, `SessionCard.tsx`, or session store (unless v2 uses a separate store or extra state).

---

### Option (b) Replace SessionCard on `/dashboard`

**Idea:** Single dashboard; v2 completely replaces the current session card.

**Steps:**

1. **Swap component**
   - In `src/app/(protected)/dashboard/page.tsx`, replace `<SessionCard />` with your v2 component (e.g. `<SessionCardV2 />`). Remove or keep `<DashboardFirstStep />` as needed.

2. **Resume**
   - v2 resume runs on every dashboard load (same as current v1): in your v2 component, call your v2 “initialize” when `authReady` is true, same pattern as SessionCard’s `useEffect(() => { if (authReady) initialize(); }, [authReady, initialize])`.

**Files to change:**

- `src/app/(protected)/dashboard/page.tsx`: use v2 session component instead of `SessionCard`.

**Optional:** Rename or keep `SessionCard.tsx` as legacy; if you no longer need v1, you can delete it after v2 is stable.

---

### Option (c) Keep v1 + “Start v2 session” button (lowest risk)

**Idea:** Default dashboard stays v1; user explicitly opts into v2 (e.g. by clicking a button).

**Steps:**

1. **Keep current dashboard**
   - Leave `src/app/(protected)/dashboard/page.tsx` as is (still `<SessionCard />` + `<DashboardFirstStep />`). v1 resume stays as today (initialize on dashboard load when authReady).

2. **Add entry point to v2**
   - Either:
     - **A) Same page, conditional UI:** On `/dashboard`, show v1 by default. Add a button “Start v2 session”. When clicked, set local state (e.g. `useState`) or a query param (e.g. `?flow=v2`) and render v2 flow instead of v1 (e.g. render `SessionCardV2` instead of `SessionCard`). When user “exits” v2, clear the state/param and show v1 again.
     - **B) Separate route (recommended):** Add `/dashboard/v2` as in option (a), and on `/dashboard` add a button “Start v2 session” that links to `/dashboard/v2`. v1 stays unchanged; v2 only loads when user goes to that route.

3. **Resume**
   - **If A (same page):** v2 resume only when v2 is actually rendered (e.g. when `flow === 'v2'`). So only when user has clicked “Start v2 session” and is seeing the v2 component.
   - **If B (separate route):** v2 resume only when user is on `/dashboard/v2` (same as option (a)).

**Files to change (for B — recommended):**

- `src/app/(protected)/dashboard/page.tsx`: add a button/link “Start v2 session” → `router.push('/dashboard/v2')` or `<Link href="/dashboard/v2">`.
- Add `src/app/(protected)/dashboard/v2/page.tsx` and v2 component as in option (a).

**Summary:** Option (c) = keep v1 on `/dashboard` + add a way to open v2 (same page with toggle, or new route). Lowest risk because v1 behavior is untouched; v2 is opt-in.

---

## 2) v2 resume: when should it run?

Two behaviors:

- **Automatic on dashboard load (like v1)**  
  - Run v2 “initialize” (or equivalent) whenever the dashboard (or the page that shows v2) loads and the user is authenticated.  
  - **Use for:** option (b) — since v2 is the only flow on `/dashboard`, resume on every load.  
  - **Use for:** option (c)A — if v2 is shown on the same page, you can run v2 initialize when the dashboard loads and you’re in “v2 mode” (e.g. from query or state); then resume runs when that page loads with v2 active.

- **Only when user enters `/dashboard/v2`**  
  - Run v2 initialize only when the user navigates to `/dashboard/v2` (i.e. when the v2 page/component is mounted). Do **not** run it when the user lands on `/dashboard` (v1).  
  - **Use for:** option (a) and option (c)B.  
  - **How:** Put v2 resume logic in the component that is mounted only on `/dashboard/v2` (e.g. inside `SessionCardV2` or the v2 page). Call your v2 initialize in a `useEffect` that runs when `authReady` is true; because that component only mounts on `/dashboard/v2`, resume runs only when the user enters v2.

**Recommendation:**

- **Option (a) or (c)B:** v2 resume **only when user enters `/dashboard/v2`** (resume logic in the v2 page or `SessionCardV2`).
- **Option (b):** v2 resume **on every dashboard load** (same pattern as current v1 initialize in SessionCard).
- **Option (c)A:** v2 resume **only when v2 is active** on the dashboard (e.g. when `flow === 'v2'` and component is mounted).

---

## 3) Minimal code sketches

### Option (a) or (c)B — `/dashboard/v2` page (resume only when entering v2)

```tsx
// src/app/(protected)/dashboard/v2/page.tsx
"use client";

import DashboardShell from "@/components/dashboard/DashboardShell";
import SessionCardV2 from "@/components/dashboard/SessionCardV2"; // your v2 component

export default function DashboardV2Page() {
  return (
    <DashboardShell>
      <SessionCardV2 />
    </DashboardShell>
  );
}
```

In `SessionCardV2`, run v2 initialize only when mounted (so only when user is on `/dashboard/v2`):

```tsx
useEffect(() => {
  if (authReady) initializeV2(); // or your v2 store’s initialize
}, [authReady, initializeV2]);
```

### Option (c) — “Start v2 session” button on `/dashboard`

```tsx
// In src/app/(protected)/dashboard/page.tsx add a button that links to v2:
import Link from "next/link";

// Inside the component, e.g. near DashboardFirstStep or in the shell:
<Link href="/dashboard/v2">
  <Button variant="outline">Start v2 session</Button>
</Link>
```

### Option (b) — Replace SessionCard with v2 on `/dashboard`

```tsx
// src/app/(protected)/dashboard/page.tsx
import SessionCardV2 from "@/components/dashboard/SessionCardV2";

export default function DashboardPage() {
  return (
    <DashboardShell>
      <SessionCardV2 />
      <DashboardFirstStep />
    </DashboardShell>
  );
}
```

Then v2 resume runs on every dashboard load (same as current `SessionCard` + `initialize()`).

---

## 4) Summary table

| Rollout | Where v2 lives | When v2 resume runs |
|--------|----------------|----------------------|
| (a) New route `/dashboard/v2` | Only on `/dashboard/v2` | Only when user enters `/dashboard/v2` |
| (b) Replace SessionCard | `/dashboard` only | On every dashboard load (like v1 today) |
| (c) Button “Start v2 session” | Same page (toggle) or `/dashboard/v2` (link) | Toggle: when v2 is active on dashboard. Link: when user enters `/dashboard/v2` |

Use this doc to decide (a)/(b)/(c) and whether v2 resume is automatic on dashboard load or only when entering v2; then implement the matching page(s) and resume logic as above.
