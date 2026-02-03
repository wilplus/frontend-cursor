# Frontend styling guidelines

Use this when implementing or changing UI so new work matches the existing frontend.

---

## Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS only. No CSS-in-JS, no SASS
- **Utilities:** `cn()` from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names
- **Icons:** Lucide React (`lucide-react`)
- **Toasts:** Sonner

---

## Design tokens (CSS variables)

Defined in `src/app/globals.css`. Use Tailwind semantic names, not raw hex.

| Token | Usage |
|-------|--------|
| `--background` / `--foreground` | Page and main text |
| `--primary` | Primary actions (orange: `24 95% 53%`) |
| `--card` / `--card-foreground` | Card background and text |
| `--muted` / `--muted-foreground` | Secondary UI, hints, “back” links |
| `--destructive` | Errors, destructive actions |
| `--input` | Input borders |
| `--ring` | Focus rings |
| `--step-completed` | Progress (green) |
| `--step-pending` | Progress (grey) |

**Tailwind usage:** `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-input`, `ring-ring`, `bg-destructive`, etc. Dark mode uses the same names via `.dark` overrides.

---

## UI components (primitives)

Location: `src/components/ui/`. Prefer these over raw HTML.

- **Button** (`button.tsx`)  
  - Variants: `default` (primary orange), `outline`, `ghost`  
  - Sizes: `default`, `sm`, `lg`, `icon`  
  - Use `className` to add classes; base is `rounded-md`, `text-sm`, `font-medium`.  
  - For big CTAs in flows: `className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-white hover:opacity-90"`.

- **Card** (`card.tsx`)  
  - Base: `rounded-xl border bg-card text-card-foreground shadow-sm`.  
  - Typical wrapper: `<Card className="p-6">` (or `p-4` for tighter blocks).

- **Input** (`input.tsx`)  
  - Base: `h-10 rounded-md border border-input`, `focus-visible:ring-2 focus-visible:ring-ring`.  
  - Use for text fields; pair with `<label className="block text-sm font-medium mb-1">`.

- **FlowBackLink** (`flow-back-button.tsx`)  
  - Muted “back” link below primary CTA in flow steps: `text-sm text-muted-foreground hover:text-foreground`, centered.  
  - Use `<FlowBackLink onClick={goBack}>back</FlowBackLink>`.

- **Progress**  
  - `ProgressPillBar` or `ProgressStepBullets` for step indicators.  
  - Step states: `bg-step-completed`, `bg-step-pending`, `bg-primary` for current.

---

## Spacing and layout

- **Section spacing:** `space-y-4` or `space-y-6` between major blocks.
- **Inline gaps:** `gap-2` (tight), `gap-3` (default), `gap-4` (wider).
- **Card padding:** `p-6` for main content, `p-4` for compact areas.
- **Page width:** Use `max-w-7xl mx-auto` (or similar) for admin/dashboard; flows often full width within shell.
- **Flow steps:** Wrap step content in a single wrapper that includes the step indicator (e.g. `ProgressStepBullets`) and `space-y-4` for content below.

---

## Typography

- **Page title:** `text-3xl font-bold` (e.g. dashboard).
- **Card/section title:** `text-lg font-semibold` or `text-lg font-bold`.
- **Body:** default (no class) or `text-sm` for secondary.
- **Labels:** `text-sm font-medium`; for big step labels use `text-lg sm:text-xl font-bold text-foreground text-center`.
- **Muted/hints:** `text-sm text-muted-foreground` or `text-xs text-muted-foreground`.
- **Errors:** `text-sm text-destructive` or `text-destructive font-medium`; error blocks often use `bg-destructive/10 text-destructive` and `rounded-md`.

---

## Buttons and CTAs

- **Primary action:** `<Button>` default (orange) or explicit `className="... bg-primary ..."`.  
  Large flow CTAs: `w-full rounded-xl bg-primary py-6 text-base font-semibold text-white hover:opacity-90`.
- **Secondary:** `<Button variant="outline">`.
- **Danger:** `variant="outline"` plus `className="border-destructive text-destructive hover:bg-destructive/10"` (or use destructive variant if added).
- **Disabled:** Rely on `disabled`; primitives use `disabled:pointer-events-none disabled:opacity-50`.
- **Native `<button>` in flows:** Use same ideas: `rounded-lg border-2`, selected state `border-primary shadow-md ring-2 ring-primary/30`, unselected `border-border hover:border-primary/50`, `transition-all`.

---

## Forms and choices

- **Labels:** Always associate with inputs; use `block text-sm font-medium mb-1` (or `mb-2`) for labels above.
- **Choice cards (e.g. Good / Not great):**  
  - Container: `flex gap-3`.  
  - Each option: `flex-1 min-w-0 py-3 px-3 rounded-lg border-2 transition-all`.  
  - Selected: `border-primary shadow-md ring-2 ring-primary/30` and `text-primary` on label.  
  - Unselected: `border-border hover:border-primary/50`.
- **Number grids (e.g. 1–10):** `flex gap-1`, cells `flex-1 aspect-square min-w-[2rem] rounded-lg border-2` with same selected/unselected pattern.
- **Select:** `w-full px-4 py-4 bg-card border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring`.

---

## Feedback and loading

- **Loading spinner:** `h-8 w-8` or `h-12 w-12` with `animate-spin rounded-full border-2 border-primary border-t-transparent`; center with `mx-auto` when in a block.
- **Loading copy:** `text-sm text-muted-foreground` (e.g. “Starting session…”, “Please wait…”).
- **Errors:** Inline: `text-sm text-destructive`. Block: `p-3 bg-destructive/10 text-destructive text-sm rounded-md text-left` with optional `font-medium` on first line.
- **Toasts:** `toast.error("...")` or `toast.success("...")` (Sonner); use for transient feedback, not as the only error display for form errors.

---

## Motion

- **Step transition:** `animate-fade-in` (defined in `globals.css`): opacity + slight translateY; use on step content so switching steps feels consistent.
- **Transitions:** `transition-all` or `transition-colors` on interactive elements (buttons, borders).

---

## Responsive and a11y

- **Touch targets:** Buttons and clickable cards use at least `py-3` or `min-w-[2rem]` where appropriate.
- **Focus:** Components use `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (or equivalent).
- **Small screens:** Use `sm:` for layout (e.g. `flex-col sm:flex-row`). Optional: `html { font-size: 14px }` at `max-width: 640px` (see `globals.css`).

---

## File and import conventions

- **Components:** `src/components/` — `ui/` for primitives, `dashboard/`, `session/`, `admin/`, `auth/`, `recording/` for feature components.
- **Styles:** Only `src/app/globals.css` and Tailwind; no new global CSS files unless necessary.
- **Class names:** Prefer Tailwind utility classes; use `cn()` when merging or conditioning (e.g. `cn("base", condition && "extra")`).
- **Icons:** Import from `lucide-react`; use `aria-hidden` on decorative icons where appropriate.

---

## Quick checklist for new UI

1. Use `Card`, `Button`, `Input` from `@/components/ui`.
2. Use semantic colors: `primary`, `muted-foreground`, `destructive`, etc.
3. Use `space-y-*` and `gap-*` for layout; `p-6` for card content.
4. Use `text-sm` / `text-lg` / `font-semibold` consistently with the table above.
5. Use `animate-fade-in` for step or list transitions.
6. Use `cn()` for any conditional or merged class names.
7. Keep error and loading patterns consistent with existing flows (spinner + muted text; destructive background for error blocks).
