# Backend: PUT sync for warm-up tasks (Flask)

The admin "Manage list" → "Confirm selection" for **warm-up tasks** sends:

- **PUT** `/v2/admin/students/<student_id>/warm-up-tasks` (no `task_id` in path)
- **Body:** `{ "pool_task_ids": ["uuid1", "uuid2", ...] }` (ordered list of IDs from `v2_warm_up_task_pool`)

The backend must **replace** the student's warm-up tasks with rows built from the pool, in that order.

---

## What to add in Flask

1. **Route:** Handle `PUT` on the same URL as GET/POST for warm-up tasks, but **without** a task_id segment (e.g. `PUT /v2/admin/students/<id>/warm-up-tasks` with no trailing `/<task_id>`).

2. **Logic (same idea as focus-tasks sync):**
   - Require admin auth.
   - Parse body: `pool_task_ids = request.get_json().get("pool_task_ids") or []`.
   - Load pool rows: for each UUID in `pool_task_ids`, select from `v2_warm_up_task_pool` (id, text, order_index, max_performance_score). Keep order.
   - In a transaction:
     - Delete existing: `DELETE FROM v2_warm_up_tasks WHERE user_id = :student_id`.
     - For each pool row in order: `INSERT INTO v2_warm_up_tasks (user_id, text, order_index, max_performance_score, pool_task_id) VALUES (:student_id, :text, :order_index, :max_performance_score, :pool_id)`.
   - Return `200` with `{ "warm_up_tasks": [ ... ] }` (the new list for this student, e.g. by selecting from `v2_warm_up_tasks` WHERE user_id = student_id ORDER BY order_index).

3. **Routing note:** If your Flask app currently has:
   - `GET/POST /v2/admin/students/<id>/warm-up-tasks`
   - `PUT/DELETE /v2/admin/students/<id>/warm-up-tasks/<task_id>`
   then add a **separate** handler for **PUT** `/v2/admin/students/<id>/warm-up-tasks` (no `<task_id>`). Check the path: when the request is PUT and the path has no task_id, dispatch to this sync handler; when it has task_id, dispatch to the existing update-one handler.

---

## Minimal Python-style pseudocode

```python
# PUT /v2/admin/students/<student_id>/warm-up-tasks  (no task_id)
def put_student_warm_up_tasks_sync(student_id):
    # 1) auth
    # 2) body = request.get_json() or {}
    # 3) pool_task_ids = body.get("pool_task_ids") or []
    # 4) rows = [fetch from v2_warm_up_task_pool where id in pool_task_ids, preserve order]
    # 5) with transaction:
    #      delete from v2_warm_up_tasks where user_id = student_id
    #      for i, row in enumerate(rows):
    #          insert into v2_warm_up_tasks (user_id, text, order_index, max_performance_score, pool_task_id)
    #          values (student_id, row.text, i, row.max_performance_score, row.id)
    # 6) new_list = select * from v2_warm_up_tasks where user_id = student_id order by order_index
    # 7) return jsonify(warm_up_tasks=new_list), 200
```

If you already have the same flow for **focus-tasks** (PUT with `pool_task_ids`), copy that and swap table names to `v2_warm_up_task_pool` and `v2_warm_up_tasks` and the response key to `warm_up_tasks`.
