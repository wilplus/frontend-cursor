# Frontend — what to know (short contract)

Single-page reference for homework UI and BFF behavior. **Backend source of truth** is Flask `/v2/homework/*`; this file tracks what the frontend must honor.

---

## Credits (homework)

- **When −5 applies:** Credits are charged **once per completed homework session**, when the session is finished **with a report** (backend idempotency: `v2_charge_homework_completion_credits_once` / `homework_credits_charged_at` — see `add_homework_credits_charged_at.sql` in the backend repo). **Not** on `POST /session/start`.
- **Start guard:** If the student has **&lt; 5** credits, **`POST /v2/homework/session/start`** returns **402** (insufficient credits). The UI must show the insufficient-credits flow; **do not** decrement credits only on the client.
- **Abandon:** Abandoning a session **does not** charge credits (only completion + report triggers the one-time charge).
- **Balance display:** **`GET /v2/homework/session/status`** includes **`credits`** on both **step 0** (`has_active_session: false`) and **during an active session** (`has_active_session: true`), so the header / flow can show the real balance without guessing. After completion, the **next** status fetch shows the reduced balance.
- **After completion:** Refetch **`GET session/status`** (or rely on your existing polling) so **`credits`** and step-0 state stay in sync — **never** fake a new balance in React state alone.

### Quick checklist — credits

| Item | Rule |
|------|------|
| Charge event | Completion + report (backend), not start |
| Start blocked | HTTP **402** if balance &lt; 5 |
| Abandon | No credit charge |
| Balance source | `credits` from **`GET session/status`** |
| Active session | Status includes `credits` while `has_active_session: true` |
| Client | Do not mutate credits locally as source of truth |

---

## Related

- Repo-wide summary: `.cursor/rules/architecture-taskmaster.mdc`
- Backend charging: `v2_charge_homework_completion_credits_once`, migration `add_homework_credits_charged_at.sql`
