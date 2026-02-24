# Backend: Assignment Email (POST send-assignment)

When the backend sends the assignment email (e.g. via Resend) on **POST /v2/admin/students/<id>/send-assignment**, it should replicate the frontend’s **CoachEmail** layout and logic. The frontend reference is `src/components/CoachEmail.tsx` and the preview is `/admin/email-preview`.

---

## 1. Request body (what the frontend sends)

- **`video_url`** (optional) – Coach video URL (e.g. Vimeo, Loom). If present, the email shows a video block with thumbnail + play link; if absent, the email shows an **orange gradient** block only.
- **`video_description`** (optional) – Coach message to the student. If present, use it as the email body text; if absent, use the default message below.

The backend can derive **“has assigned exercise”** from the student’s overrides: if `assigned_next_exercise_id` is set, the student has an exercise assigned.

---

## 2. Email content rules (what to put in the HTML)

### Video block (top of main card)

- **If `video_url` is present**
  - Show a video section: thumbnail (if you have one) + dark overlay + centered **orange play button** linking to `video_url`.
  - Optional: duration badge (e.g. "4:32") if you have it.
- **If `video_url` is absent**
  - Show the **same aspect-video area** but with an **orange gradient** only (no image, no play button).  
  - Use a gradient like: orange → orange-500 → amber (e.g. `hsl(25 95% 53%)` to `hsl(38 92% 50%)`). No link.

### Coach message (body text)

- **If `video_description` (or your coach message field) is present**
  - Use it as the body text. Support multiple paragraphs (e.g. split on `\n\n`).
- **If absent**
  - Use this **exact default**:  
    **"Good work. It is a small step for you, but a huge step for your progress!"**

### Assigned exercise line (inside the “Homework” CTA block)

- **If the student has an assigned exercise** (e.g. `assigned_next_exercise_id` is set in overrides):
  - Add this line above the “View Homework” button (or equivalent):  
    **"You have an exercise assigned — it will appear on the main screen after you follow the link below."**
- **If no exercise is assigned**
  - Omit that line entirely.

---

## 3. Design tokens (for replicating the layout)

- **Colors (HSL):**  
  `--primary`: 25 95% 53% (orange, buttons/play/accents)  
  `--foreground`: 220 25% 14% (dark navy, text)  
  `--background`: 0 0% 100% (white card)  
  `--muted-foreground`: 220 9% 46% (gray, labels)  
  `--secondary`: 220 14% 96% (light gray, CTA card bg)  
  `--border` / `--email-divider`: 220 13% 91%  
  `--email-bg`: 220 14% 96% (page background behind card)

- **Fonts:**  
  Headings: **DM Serif Display**  
  Body: **DM Sans**

- **Layout:**  
  Centered single column, max width 600px. Card: white, rounded corners (~0.75rem), subtle shadow.  
  Structure: Brand header (“Willab.” + orange dot + tagline) → main card (video block → body → divider → Homework CTA card → coach footer) → footer links (Unsubscribe · Preferences).

---

## 4. Summary for backend

| Input                         | Email behavior |
|-------------------------------|----------------|
| `video_url` set               | Video block: thumbnail + play link (or link-only if no thumbnail). |
| `video_url` not set           | Same-size block: **orange gradient only**, no play button. |
| Coach message set             | Use it as body text. |
| Coach message not set         | Use: *"Good work. It is a small step for you, but a huge step for your progress!"* |
| Student has assigned exercise | Add line: *"You have an exercise assigned — it will appear on the main screen after you follow the link below."* |
| No assigned exercise          | Do not show that line. |

No backend change is required for the **Homework screen** itself: the frontend already shows assigned exercises on step 0 from **GET /v2/homework/session/status** when `assigned_exercises` is returned (derived from the student’s `assigned_next_exercise_id` in overrides).
