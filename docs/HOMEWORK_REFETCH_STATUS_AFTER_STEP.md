# Optional: Refetch session status after step-advancing calls

**Do not implement until explicitly requested.**

---

## What to add

After a successful **step-advancing** call, refetch **GET session/status** and re-derive the step from `session.status`. That keeps status as the single source of truth not only on load but also after each transition.

### Step-advancing calls

- **POST recording-1** (success) → backend moves to `task_block` → refetch status → derive step 2.
- **POST metric-answers** (success) → backend moves to `final_task_ready` → refetch status → derive step 3.
- **POST recording-2** (success) → backend moves to `post_questions` or `completed` → refetch status → derive step 4 or 5.

### Behavior

1. After each of these mutations returns success, call **GET /api/homework/session/status** (or BFF equivalent).
2. From the response, set `sessionId` if needed (`session_id ?? session?.id`), then run **deriveStepFromStatus(response)** and update all UI state (step, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd, etc.) from that derived result.
3. The UI then shows the next step (e.g. task_block → step 2, final_task_ready → step 3) from backend state instead of only from local state.

### If already done

If the frontend **already** refetches status after these mutations, no change is needed. If it currently advances the step only from local state after success (e.g. `setStep(2)` after recording-1 response), adding this refetch will keep the UI and backend in sync.

---

**When to implement:** Wait for explicit “Implement” from the product/tech lead.
