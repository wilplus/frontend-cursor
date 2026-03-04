# Manual testing: Post-recording questions (reflective step)

Use this checklist to verify the “next step” after the warm-up recording: **reflective questions** (e.g. “How was this recording for you? (1–5)”) and then the report.

**Prerequisites**

- Backend returns `status: "post_questions"` after **POST recording-1** (warm-up upload).
- Student has **exactly 3** post-recording questions assigned in admin (backend requirement for `GET .../questions`).
- You are logged in as a **student** (dashboard homework flow).

---

## 1. Flow: Record → Questions → Report

- [ ] **1.1** From dashboard, start a homework session (e.g. “Start Your Practice”).
- [ ] **1.2** Complete the warm-up recording (min duration as required, e.g. 30s) and wait for upload to finish.
- [ ] **1.3** After upload, the next screen is **“Reflective questions”** (not the report).  
  - If you see the report immediately, the backend may be returning `task_block` or `completed` instead of `post_questions`; fix backend to return `post_questions` after recording-1.
- [ ] **1.4** The navbar is visible on the questions screen.
- [ ] **1.5** You see the list of post-recording questions (e.g. “Did you achieve the intended emotion?”, “How was this recording for you? (1–5)”, “Any reflection to add?”).
- [ ] **1.6** Answer all questions (use text / numbers as appropriate; current UI uses text inputs for all).
- [ ] **1.7** Click **“See my report”** (or equivalent submit). Button is disabled until all answers are filled.
- [ ] **1.8** After submit, you are taken to the **report** screen (final recording, chart, report text, “Start new homework”, etc.).
- [ ] **1.9** Report content loads (no infinite “Loading report…”). If you see “Your report is being generated”, wait or use “Check again” as per existing behavior.

---

## 2. Empty questions (no questions assigned)

- [ ] **2.1** Use a student who has **no** post-recording questions assigned (or backend returns empty list for `GET .../questions`).
- [ ] **2.2** Complete the warm-up recording; backend still returns `post_questions`.
- [ ] **2.3** You see the **“No questions this time”** (or similar) message and a single **“Continue to report”** button.
- [ ] **2.4** Click **“Continue to report”**. You are taken to the report; no errors (backend accepts `POST .../post-answers` with empty `answers` and moves to `completed`).

---

## 3. Questions fetch error

- [ ] **3.1** Simulate failure of **GET .../questions** (e.g. wrong session, network off, or backend 5xx).
- [ ] **3.2** After recording upload (backend returns `post_questions`), you see an error message (e.g. “Could not load questions”) and the **“Continue to report”** button.
- [ ] **3.3** Click **“Continue to report”**. Either you reach the report (if backend allows empty post-answers) or you see a clear error; no uncaught exception or blank screen.

---

## 4. Submit and validation

- [ ] **4.1** On the questions screen, leave at least one question empty and try to submit.  
  - **Expected:** Button stays disabled and/or you see “Please answer all questions before continuing.” (no POST).
- [ ] **4.2** Fill all answers and submit.  
  - **Expected:** Loading state (“Submitting…”), then redirect to report; answers are sent as `POST .../post-answers` with correct `question_id` and `answer_text` per question.

---

## 5. Navbar and layout

- [ ] **5.1** On **step 0** (start): navbar visible.
- [ ] **5.2** On **step 1** (recording): navbar hidden (existing behavior).
- [ ] **5.3** On **step 4** (reflective questions): navbar visible.
- [ ] **5.4** On **step 5** (report): navbar visible.

---

## 6. Abandon / new session

- [ ] **6.1** From the questions screen, if “Abandon session” (or similar) is available, use it. You return to start (step 0); no stale questions or report from the abandoned session.
- [ ] **6.2** Start a new session, complete recording, and confirm the questions step appears again with a fresh set of questions (or “No questions this time” if none assigned).

---

## 7. Backend contract (for reference)

- **After POST recording-1:** Response should include `status: "post_questions"` (and optionally `questions`) so the frontend shows the reflective step.
- **GET .../session/:id/questions:** Returns `{ questions: [...] }` when the student has the required number (e.g. 3) assigned; may return empty array.
- **POST .../session/:id/post-answers:** Body `{ answers: [ { question_id, answer_text }, ... ] }`. Must accept empty `answers` when there are no questions and transition session to `completed` and allow **GET report** to succeed.

---

**Quick smoke test**

1. Start homework → record warm-up → see “Reflective questions” → answer all → “See my report” → see report.  
2. (Optional) Student with no questions → record → “No questions this time” → “Continue to report” → see report.
