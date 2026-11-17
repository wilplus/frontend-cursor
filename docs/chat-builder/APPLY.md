# Backend phase 1, ready to apply

> **Label: Reference.** Not in force. The frontend pull request calls these routes. This repository could not push to `wilplus/backend-cursor` (403 for `cursor[bot]`).

Apply on a branch of `wilplus/backend-cursor` from `main`:

```bash
git apply docs/chat-builder/coach-definition-phase1.patch
```

The patch is [`coach-definition-phase1.patch`](coach-definition-phase1.patch), taken from local branch `cursor/coach-definition-phase1-027f` (commit `00ad60a` in the clone). It adds:

- `services/coach_definition.py` — validate, store on `runtime_config`, check a paste, preview that does not write, publish
- `routes/v2/coaches.py` — `/v2/coaches/speaking-coach` and its draft, preview, plugins, publish, and active reads
- `routes/v2/__init__.py` — registers that module
- `services/tempo_stretch.py` — `pick` takes an optional `min_outside`; `tempo_for_take` uses a published dial when one exists, and otherwise today's `MIN_OUTSIDE`
- `tests/test_coach_definition.py`

`python3` ran those four tests without pytest (the module is standard library only). `moment_pick` still reads `noticing_settings`. Only the tempo stretch's bar is read from a published document.
