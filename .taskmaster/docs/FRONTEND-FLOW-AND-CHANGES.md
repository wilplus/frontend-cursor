# Frontend flow: current behavior and what changed

See APP_DESCRIPTION.md for full taskmaster. This doc summarizes (1) how the frontend flow looks now and (2) what changed.

## 1. Current frontend flow (step-by-step)

| Step | UI | Status (canonical or alias) | Behavior |
|------|-----|-----------------------------|----------|
| 0 | Start | — | POST start → GET status → apply |
| 1 | Warm-up record | warm_up | AudioRecorder min 60s; timer in onstart; Stop disabled until min |
| 2 | Metric Qs (3) | task_block (+ aliases) | AnswerMetricQuestionsScreen; POST metric-answers → GET status |
| 3 | Final record | final_task_ready (+ aliases) | AudioRecorder min 62s; onstart first+resume; Stop disabled until 62s |
| 4 | Reflective Qs | post_questions (+ aliases) | PostQuestionsStepScreen (local state); submit(answersFromChild) |
| 5 | Report | completed (+ aliases) | Report + score |

Step 4: StepFlowWrapper (stable). handlePostAnswersSubmit(answersFromChild) → POST post-answers. Debug: debugIngest() only when NODE_ENV=development.

## 2. Status aliases (added)

After recording 1 backend may return warmup_recorded, warmup_scored, focus_selected, task_generated → we map to step 2. Similarly step 3/4/5 aliases (final_task_ready, recording2_uploaded, post_questions_done, etc.).

## 3. What changed

- Recording 1 → step 2: aliases so user is not thrown back to step 1.

- Step 4 form: PostQuestionsStepScreen + local state + stable wrapper; submit uses child answers.

- Recording-2: startTimeRef in recorder.onstart (first and resume); min 62s; Stop disabled until min; 422 surfaced; timer reset on too-short.

- Debug ingest: single debugIngest(); no request in production.

## 4. Status aliases (explicit list)

| Backend returns | Mapped step |
|-----------------|-------------|
| warmup_recorded, warmup_scored, focus_selected, task_generated | 2 |
| final_task, ready_for_final, final_task_ready | 3 |
| post_task, post_task_questions, reflective, recording2_uploaded, recording2_scored | 4 |
| finished, done, post_questions_done, report_generated | 5 |

Canonical five (unchanged): warm_up→1, task_block→2, final_task_ready→3, post_questions→4, completed→5.

## 5. Before vs now (explicit)

| Area | Before | Now |
|------|--------|-----|
| After recording 1 | Only status `task_block` → step 2. Other (e.g. warmup_recorded) → unknown → step 1. | Aliases map warmup_recorded etc. → step 2. User reaches metric questions. |
| Step 4 form | Inline in parent; parent postAnswers; typing re-rendered parent; wrapper recreated → remount → input blocked. | PostQuestionsStepScreen (local state); StepFlowWrapper stable; no remount; submit(answersFromChild). |
| Step 4 submit | Handler read parent postAnswers (empty when form in child). | handlePostAnswersSubmit(answersFromChild); payload from child; POST post-answers correct. |
| Recording-2 timer | startTimeRef on click; recorder.start() after; resume set startTime before start(). Gap → UI 60s, blob ~58s → 422. | startTimeRef in recorder.onstart (first start and resume); Math.floor duration; min 62s; Stop disabled until elapsed ≥ min. |
| Recording-2 422 | Not clearly surfaced. | RECORDING_DURATION_OUT_OF_RANGE → message with min/max and "You recorded Xs". |
| Too-short recording | Stop allowed; toast; timer showed e.g. "00:06 remaining" next. | Stop disabled until min; on reject setElapsedSeconds(0) → "01:00 remaining". |
| Debug ingest | Inline fetch to 127.0.0.1:7242/7243 in several files; CORS in prod. | debugIngest(url, payload); NODE_ENV !== "development" → return; no request in prod. |
