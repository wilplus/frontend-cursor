# API JSON request/response spec — current vs v1 (theme + 1 preQ + 3 command options)

This document describes the **current** request/response shapes used by the frontend/BFF and the **explicit additions** required for the v1 planned-session flow (theme → 1 typed pre-question → 3 command options → record → upload with `command_option_id`).

---

## 1) POST /session/start

### Current

**Request (frontend → BFF → Flask):**
```json
{
  "questionnaire": {
    "mood": "positive",
    "readiness": 5,
    "inspiration_needed": false
  }
}
```
- `questionnaire` is optional; if omitted, frontend sends `{}` (resume / get new session).
- `mood`: frontend type is `"positive" | "negative"` (smiley picker).
- `readiness`: number 1–10 (body/mind readiness).
- `inspiration_needed`: boolean (maps to guided/open).

**Response (Flask → BFF → frontend):**
```json
{
  "session_id": "uuid",
  "pre_questions": [
    {
      "id": "uuid",
      "question_text": "string",
      "order_index": 0,
      "created_at": "ISO8601"
    }
  ],
  "cursor": 0.65,
  "mode": "guided",
  "structure": "guided"
}
```
- `cursor`, `mode`, `structure` are optional.
- `pre_questions`: currently an array (often 3 items); frontend uses it as the list of pre-questions to render.

### V1 additions

**Request — add:**
- `session_id` (optional, string, UUID): when present, backend treats as resume; return existing plan idempotently.
- `questionnaire.theme_code` (optional, string): user override theme, e.g. `"clarity_simplicity"`.
- `questionnaire.cursor` (optional, number): already used by backend; keep if present.
- `questionnaire.mode` (optional, string): `"guided" | "open"`; canonical field; backend should mirror to `structure` during rollout.

**Request — keep unchanged:**
- `questionnaire.mood`, `questionnaire.readiness`, `questionnaire.inspiration_needed`.

**Response — add:**
- `theme_recommended_code` (string): e.g. `"presence_grounding"`.
- `theme_recommended_reason` (string, optional): short explanation.
- `theme_chosen_code` (string): final theme for this session.
- `theme_chosen_source` (string): `"system" | "user" | "admin"`.
- `pre_questions`: **must be array of length 1** in v1. Each item must include:
  - `id` (UUID)
  - `code` (string): e.g. `"presence_grounding_q1"`.
  - `question_text` (string)
  - `question_type` (string): `"scale_1_5" | "binary_yes_no" | "binary_choice" | "text_short"`.
  - `order_index` (number, optional)
- `command_options` (array of exactly 3 items). Each item:
  - `option_id` (string): `"A" | "B" | "C"`.
  - `intent` (string): e.g. `"permission_imperfect"`.
  - `tier` (number).
  - `mode` (string): `"guided" | "open"`.
  - `prompt_text_snapshot` (string): **the recording prompt text** the user will speak to.
  - `is_primary` (boolean): which option is the default/recommended.

**Response — keep:**
- `session_id`, `cursor`, `mode`, `structure` (for rollout; frontend can keep using `mode` or `structure`).

**Response — remove or deprecate for v1:**
- No longer return 3 generic pre-questions; only the single planned pre-question in `pre_questions[0]`.

---

## 2) GET /questions/pre-recording (optional in v1)

### Current

- **Not used by the frontend.** Pre-questions come from `POST /session/start` response only.

### V1 (backend contract)

- If backend supports this endpoint for v1: require query param `session_id`.
- Response: return the **planned** pre-question from session snapshots as a list of length 1.
- Backward compat: if `session_id` is missing, return legacy 3 global questions so old clients don’t break.

**Response shape (when used):**
```json
[
  {
    "id": "uuid",
    "code": "string",
    "question_text": "string",
    "question_type": "scale_1_5",
    "order_index": 0
  }
]
```

---

## 3) POST /questions/pre-recording/answers

### Current

**Request (frontend → BFF → Flask):**
```json
{
  "session_id": "uuid",
  "answers": [
    {
      "question_id": "uuid",
      "answer_text": "string"
    }
  ]
}
```
- Frontend sends one entry per pre-question; `answer_text` is string (e.g. `"4"`, `"Yes"`, `"I want to slow down"`).
- Backend may expect `recording_session_id`; BFF/Flask might map `session_id` → `recording_session_id` (confirm in backend).

**Response (current):**
```json
{
  "session_id": "uuid",
  "pre_questions_completed": true
}
```

### V1 additions

**Request — keep:**
- `session_id`, `answers[]` with `question_id`, `answer_text`.

**Request — optional (if backend expects different key):**
- Backend may require `recording_session_id` instead of `session_id`; if so, frontend or BFF should send the same UUID under the key the backend expects.

**Response — unchanged:**
- Same `session_id`, `pre_questions_completed: true`.

**Backend behavior (for reference):**
- In v1 there is exactly one planned pre-question; `answers` should have length 1.
- Backend should store snapshot columns on `pre_recording_answers`: `question_text_snapshot`, `question_type_snapshot`, `question_code_snapshot`, `order_index_snapshot`.

---

## 4) POST /recordings/upload (multipart/form-data)

### Current

**Request (frontend → BFF → Flask):** `FormData` with:
- `audio` (File): blob, filename e.g. `recording.webm`.
- `session_id` (string): session UUID.
- `duration_seconds` (string): number as string.

No JSON body; all fields are form fields.

**Response (Flask → BFF → frontend):**
```json
{
  "recording_id": "uuid",
  "status": "recording_uploaded",
  "post_questions": [
    {
      "id": "uuid",
      "question_text": "string",
      "question_type": "scale",
      "order_index": 0,
      "question_set_id": 1
    }
  ]
}
```

### V1 additions

**Request — add one required form field:**
- `command_option_id` (string): **required**. Value `"A"` | `"B"` | `"C"` (the option the user selected before recording).

**Request — keep:**
- `audio`, `session_id`, `duration_seconds`.

**Response — keep:**
- `recording_id`, `status`, `post_questions`.

**Response — optional (if backend wants to echo selection):**
- `selected_command_option_id`, `selected_intent`, `selected_prompt_text_snapshot` (for debugging or UI); not required if frontend already has them from start response + user selection.

---

## 5) POST /questions/post-recording/answers

### Current

**Request:**
```json
{
  "recording_id": "uuid",
  "session_id": "uuid",
  "answers": [
    {
      "question_id": "uuid",
      "answer_text": "1"
    }
  ]
}
```
- Scale: `answer_text` `"1"`–`"5"`.
- Binary: `"YES"` / `"NO"`.
- Free text: arbitrary string.

**Response:**
```json
{
  "recording_id": "uuid",
  "session_id": "uuid",
  "post_questions_completed": true,
  "performance_score": { ... }
}
```

### V1 additions

- **No request/response shape change** for this endpoint.
- Backend stores post Q1 scale answer as `performance_scores.self_rating_score` (not `awareness_score`); frontend does not need to send anything extra.

---

## 6) GET /session/status

### Current

**Response:**
```json
{
  "has_active_session": true,
  "session_id": "uuid",
  "pre_questions_completed": false,
  "recording_completed": false,
  "post_questions_completed": false,
  "recording_id": null,
  "created_at": "ISO8601",
  "completed_at": null,
  "abandoned_at": null
}
```

### V1 additions

- Optional: `theme_chosen_code`, `planned_pre_question_id`, `selected_command_option_id` if backend wants to expose them for resume UX; not required for minimal v1.

---

## 7) Summary table — what to add

| Endpoint | Request additions | Response additions |
|----------|-------------------|--------------------|
| **POST /session/start** | `session_id` (resume), `questionnaire.theme_code`, `questionnaire.mode` | `theme_recommended_code`, `theme_recommended_reason`, `theme_chosen_code`, `theme_chosen_source`, `pre_questions` length 1 with `code`, `question_type`, `command_options[]` with `option_id`, `intent`, `tier`, `mode`, `prompt_text_snapshot`, `is_primary` |
| **GET /questions/pre-recording** | Query `session_id` (if used) | List of 1 item with `code`, `question_type` (backward compat: no session_id → legacy 3 questions) |
| **POST /questions/pre-recording/answers** | None | None (backend stores snapshots) |
| **POST /recordings/upload** | **Required form field:** `command_option_id` (`"A"`\|`"B"`\|`"C"`) | None required (optional echo of selection) |
| **POST /questions/post-recording/answers** | None | None (backend uses Q1 for `self_rating_score`) |
| **GET /session/status** | — | Optional: theme/preQ/command fields for resume |

---

## 8) Frontend type changes (TypeScript) — explicit additions

- **SessionStartRequest:**  
  - Add optional `session_id?: string`, `questionnaire.theme_code?: string`, `questionnaire.mode?: "guided" | "open"`.

- **SessionStartResponse:**  
  - Add `theme_recommended_code: string`, `theme_recommended_reason?: string`, `theme_chosen_code: string`, `theme_chosen_source: "system" | "user" | "admin"`.  
  - Add `command_options: { option_id: "A" | "B" | "C"; intent: string; tier: number; mode: string; prompt_text_snapshot: string; is_primary: boolean }[]`.  
  - Extend `PreRecordingQuestion` with `code: string`, `question_type: "scale_1_5" | "binary_yes_no" | "binary_choice" | "text_short"`.  
  - Document that `pre_questions` in v1 has length 1.

- **PreRecordingQuestionnaireInput:**  
  - Add optional `theme_code?: string`, `mode?: "guided" | "open"`.

- **Upload (FormData):**  
  - Append `command_option_id` (`"A"` | `"B"` | `"C"`) to the FormData in `uploadRecordingBlob` (and any other upload path).

- **PerformanceScore (types):**  
  - Add optional `self_rating_score?: number` (generic Q1 scale); keep existing `raw_scores.awareness_score` for backward compat if backend still returns it, but new backend field is `self_rating_score`.

This file is the single reference for current JSON shapes and the exact v1 additions for the theme + 1 preQ + 3 command options flow.
