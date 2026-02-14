# Backend summary: Default warm-up question

## Behaviour

When a user has **no warm-up task assigned** (or the backend returns an empty/null warm-up), the **frontend** shows a default question so the flow can continue without errors.

## Default question (frontend)

- **Text:** `"How was your day so far?"`
- **Used when:** The warm-up task from the API is missing, `null`, or empty string.

## API contract (no backend change required)

- **POST `/v2/homework/session/start`**  
  - May return `warm_up_task: null`, `warm_up_task: {}`, or `warm_up_task: { text: "" }`.  
  - The frontend treats all of these as “no warm-up” and substitutes the default question.  
  - If you send `warm_up_task: { text: "Your custom prompt" }`, that is shown instead.

- **GET `/v2/homework/session/status`** (and any payload that restores session state)  
  - If `warm_up_task` / `warm_up_task_text` is missing or empty in the response, the frontend again uses the default question for step 1.

## Backend options

1. **Do nothing**  
   Omit or leave empty the warm-up field; the frontend will show *"How was your day so far?"*.

2. **Assign a custom warm-up per user/cohort**  
   Return `warm_up_task: { text: "…" }` (or equivalent) from start/status; the frontend will show that and only fall back to the default when it’s empty.

3. **Provide a global default in the backend**  
   You can still return a default from your side (e.g. same text). The frontend default is a fallback so the UI never shows “no prompt” or blocks the user.

## Summary

| Backend returns                     | Frontend shows                |
|-------------------------------------|-------------------------------|
| No / null / empty warm-up           | `"How was your day so far?"`  |
| `warm_up_task: { text: "…" }`       | The returned text             |

No API changes are required; the frontend handles missing or empty warm-up by applying this default.
