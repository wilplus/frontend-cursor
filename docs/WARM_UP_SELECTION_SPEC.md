# Warm-up task selection — backend spec (FINAL)

Use this in the **backend** to implement how the warm-up task is chosen when a student starts homework. The **frontend** only calls `POST /v2/homework/session/start` and displays the returned `warm_up_task_text`; all selection logic runs on the backend.

---

## Schema

Each warm-up task has a **max_performance_score** field (0–1 scale).

```sql
-- In warm-up tasks table (e.g. v2_warm_up_tasks or equivalent)
max_performance_score DECIMAL(3,2)  -- e.g. 0.60, 0.75, 1.00
```

- **Admin API:** GET/POST/PUT for warm-up tasks must return and accept `max_performance_score` (number 0–1). See `BACKEND_ADMIN_SYNC_AFTER_SIMPLIFIED_UI.md` for the contract.
- **Student start:** Backend loads the student’s last `performance_score_end` (from last homework report) and the student’s available warm-up tasks (with `max_performance_score`), then runs the selection below.

---

## Selection logic

### Rule 1: Filter eligible warm-ups

- **Eligible:** `max_performance_score >= student's last performance_score_end`
- So students get warm-ups appropriate to their current level (warm-up “max” is at least their last score).

### Rule 2: Closest match

- Among eligible warm-ups, choose the one(s) whose `max_performance_score` is **closest** to the student’s last score.
- “Closest” = within **±0.03 (3%)** tolerance of that closest value.

### Rule 3: Randomize if multiple

- If more than one warm-up falls in that ±3% band, use **random.choice()** (or equivalent) to pick one.
- Reduces repetition and adds variety.

### Rule 4: First-time student (no previous report)

- If there is **no** previous homework report for the student:
  - Use the **easiest** warm-up = the one with the **highest** `max_performance_score` (typically 1.0).

### Fallback: Student scored higher than all warm-ups

- If the student’s last score is **higher** than every warm-up’s `max_performance_score` (no eligible warm-ups):
  - Return the **hardest** warm-up = the one with the **lowest** `max_performance_score`.

---

## Implementation (Python)

```python
def select_warm_up_task(student_last_score, available_warm_ups):
    """
    Select warm-up task based on student's last performance_score_end.

    Args:
        student_last_score: float (0-1) or None if first-time student
        available_warm_ups: list of warm-up tasks with max_performance_score

    Returns:
        Selected warm-up task object
    """
    import random

    TOLERANCE = 0.03  # ±3% for "close" matching

    # CASE 1: First-time student (no previous score)
    if student_last_score is None:
        easiest = max(available_warm_ups, key=lambda x: x.max_performance_score)
        return easiest

    # CASE 2: Returning student — filter eligible (max_score >= student's score)
    eligible = [
        w for w in available_warm_ups
        if w.max_performance_score >= student_last_score
    ]

    # Fallback: student scored too high for all warm-ups
    if not eligible:
        return min(available_warm_ups, key=lambda x: x.max_performance_score)

    # Find closest match score
    closest_score = min(
        eligible,
        key=lambda x: abs(x.max_performance_score - student_last_score)
    ).max_performance_score

    # All warm-ups within ±3% of closest score
    closest_warm_ups = [
        w for w in eligible
        if abs(w.max_performance_score - closest_score) <= TOLERANCE
    ]

    return random.choice(closest_warm_ups)
```

---

## Examples

| Scenario | Student last score | Warm-ups (max_performance_score) | Result |
|----------|--------------------|-----------------------------------|--------|
| Example 1 | 0.65 | A:1.0, B:0.7, C:0.68, D:0.67, E:0.4 | Eligible: A,B,C,D. Closest to 0.65: D (0.67). Within ±0.03: C (0.68), D (0.67). **Random choice C or D.** |
| Example 2 | 0.85 | A:1.0, B:0.9, C:0.87 | Eligible: A,B,C. Closest: C (0.87). Within ±0.03: only C. **Select C.** |
| Example 3 | None (first time) | A:1.0, B:0.7, C:0.4 | **Select A** (highest max = easiest). |
| Example 4 | 0.95 | A:0.9, B:0.7, C:0.6 | Eligible: none. Fallback: **Select A** (lowest max = hardest). |

---

## Admin panel (frontend)

- When creating/editing a warm-up task, the admin can set **Max performance score** (0.00–1.00).
- Helper text: *“Show this warm-up to students with last performance ≤ this score.”*
- Recommended distribution:
  - 1–2 warm-ups with max_score = 1.0 (beginners / first-time)
  - 3–4 warm-ups with max_score = 0.5–0.8 (intermediate)
  - 1–2 warm-ups with max_score = 0.3–0.5 (advanced)

---

## Summary

- **Backend:** Implements the selection algorithm on `POST /v2/homework/session/start`; stores and returns `max_performance_score` in warm-up task GET/POST/PUT.
- **Frontend (student):** No change; just displays the chosen `warm_up_task_text` from start.
- **Frontend (admin):** Allows editing `max_performance_score` per warm-up task; create sends a default (e.g. 1.0) if not set.
