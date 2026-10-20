# Backend: Persist and honor “flow steps” overrides (skip step 2 / step 4)

---

## Problem summary (for backend team)

**What’s broken:** In the admin panel, coaches can turn “Step 2: Metric questions” and “Step 4: Post-questions” on or off per student. When they click **“Save flow steps”**, the frontend sends these two values to **PUT `/v2/admin/students/<id>/overrides`**. After a refresh (or opening the student again), the toggles always show both steps as **on** again. So the choices are **not persisting**.

**Why:** Either (1) the backend is **not storing** `skip_metric_questions` and `skip_post_questions` when it receives them in the PUT body, or (2) the backend **does not return** these two keys in the **GET `/v2/admin/students/<id>`** response under `overrides`. The frontend only knows what was saved by reading `response.overrides.skip_metric_questions` and `response.overrides.skip_post_questions` from that GET. If they’re missing, the UI resets to “both steps on”.

**What you need to do:**

1. **PUT `/v2/admin/students/<id>/overrides`**  
   Accept the body fields `skip_metric_questions` and `skip_post_questions` (both booleans). **Persist them** in the same place you store other student overrides (e.g. JSON column or overrides table). Do not drop or ignore these keys.

2. **GET `/v2/admin/students/<id>`**  
   In the `overrides` object (or whatever you return for student overrides), **include** the saved values for `skip_metric_questions` and `skip_post_questions`. If they were never set, return `false` or omit them (frontend treats missing as false).

Once both are done, the admin toggles will save and reload correctly. Optional: use these flags in the homework flow so students actually skip step 2 or 4 (see below).

---

## Detail: What the frontend does

The frontend admin panel lets coaches turn **step 2 (Metric questions)** and **step 4 (Post-questions)** on or off per student. These are sent and loaded via the existing **student overrides** API. Right now they are **not being saved** on the backend, so the toggles have no effect after refresh.

---

## What the frontend does

1. **Load (GET student profile)**  
   The admin page calls **GET `/v2/admin/students/<id>`** and expects the response to include:
   ```json
   {
     "overrides": {
       "skip_metric_questions": false,
       "skip_post_questions": false,
       ...other existing override fields...
     }
   }
   ```
   - `skip_metric_questions`: when `true`, the student should skip step 2 (metric questions).
   - `skip_post_questions`: when `true`, the student should skip step 4 (post-questions).
   - If these keys are missing, the frontend treats them as `false` (steps are included).

2. **Save (PUT overrides)**  
   When the coach clicks “Save flow steps”, the frontend calls **PUT `/v2/admin/students/<id>/overrides`** with a JSON body that includes **all** current overrides plus the two flow flags, for example:
   ```json
   {
     "intended_emotion_prompt": "...",
     "keywords_prompt": "...",
     "skip_metric_questions": true,
     "skip_post_questions": false
   }
   ```
   The frontend sends whatever it has in `profile.overrides` plus `skip_metric_questions` and `skip_post_questions`. The backend must **accept these two keys**, **persist them** (e.g. in the same table/column as other overrides), and **return them** in GET student profile so the next load shows the correct toggles.

---

## What the backend must do

### 1. Persist and return the two new override fields

- **PUT `/v2/admin/students/<id>/overrides`**  
  - Accept optional body fields: `skip_metric_questions` (boolean), `skip_post_questions` (boolean).  
  - Store them in whatever storage holds student overrides (e.g. a JSON column or separate columns).  
  - Do not strip or ignore these keys; the frontend relies on them.

- **GET `/v2/admin/students/<id>`** (student profile)  
  - Include in the `overrides` object (or equivalent) the persisted values for `skip_metric_questions` and `skip_post_questions`.  
  - If never set, return `false` or omit (frontend treats missing as `false`).

After this, the admin “flow steps” toggles will **persist** and **reload** correctly.

### 2. (Optional) Use overrides in the homework flow so steps are actually skipped

For the student to **actually** skip step 2 or 4, the backend must use these overrides when driving the session status:

- **When `skip_metric_questions` is true for that student:**  
  After the student completes **recording 1**, do not set status to `task_block` (step 2). Set it to `final_task_ready` (step 3) so the next GET session/status shows step 3 (final recording).  
  - So: recording_1 complete → if override set, transition to `final_task_ready` (and e.g. generate final task from a default or existing logic); otherwise transition to `task_block` as today.

- **When `skip_post_questions` is true for that student:**  
  After the student completes **recording 2**, do not set status to `post_questions` (step 4). Set it to `completed` and generate the report (or whatever you do after post-answers).  
  - So: recording_2 complete → if override set, transition to `completed` and generate report; otherwise transition to `post_questions` as today.

The frontend does **not** send these overrides on homework APIs; it only sends them on **PUT overrides** and reads them from **GET student profile**. So for the homework flow you need to **load the student’s overrides** when handling recording-1 and recording-2 (or when returning GET session/status) and branch on `skip_metric_questions` / `skip_post_questions` as above.

---

## Summary checklist for backend

- [ ] **PUT overrides:** Accept and persist `skip_metric_questions` and `skip_post_questions` (booleans). Do not drop them.
- [ ] **GET student profile:** Return `skip_metric_questions` and `skip_post_questions` inside `overrides` (or the same structure the frontend already uses).
- [ ] **(Optional)** After recording 1: if `skip_metric_questions` is true, set status to `final_task_ready` instead of `task_block`.
- [ ] **(Optional)** After recording 2: if `skip_post_questions` is true, set status to `completed` and generate report instead of `post_questions`.

Once 1 and 2 are done, the flow steps will at least **save and load** correctly in the admin. Steps 3 and 4 make the simplified flow (e.g. warm-up → final recording → report) work for the student.

---

## Troubleshooting (“still doesn’t work”)

1. **Confirm the frontend is sending the right body**  
   In the browser Network tab, when the coach clicks “Save flow steps”, find the request to **PUT `/api/admin/students/<id>/overrides`** (or the backend URL it proxies to). The request body must include:
   - `skip_metric_questions` (boolean)
   - `skip_post_questions` (boolean)  
   The frontend always sends these two keys; it may also send other override fields. If this request returns **4xx**, the frontend will show an error toast. If it returns **200**, the backend must persist these two fields.

2. **Confirm the backend persists them**  
   After a successful PUT, the backend must write `skip_metric_questions` and `skip_post_questions` into the same place it stores other overrides (e.g. a JSON column or a row that GET student profile reads from). If the backend only accepts a fixed list of keys and ignores “unknown” keys, add these two to the allowed list and persist them.

3. **Confirm GET student profile returns them**  
   When the admin opens the student profile (or refreshes), the frontend calls **GET `/v2/admin/students/<id>`** and sets the two checkboxes from `response.overrides.skip_metric_questions` and `response.overrides.skip_post_questions`. If those keys are missing from the response, the frontend shows both steps as “on” (checked). So the backend must include them in the `overrides` object of the GET response. Check the actual JSON returned by GET student profile and ensure `overrides` contains `skip_metric_questions` and `skip_post_questions`.
