# The consent screens and the Data & consent page

> **Label: In force** · one of the rules, read in N95's order. Every doc and its label: [the master doc](https://github.com/wilplus/backend-cursor/blob/main/README.md) (N106).

One page for the consent screens (the one acceptance screen, the documents in a window, Nothing was recorded), the policy update prompt and the Data & consent page. Started 2026-10-21 (backend N107) from the founder lock it replaces, backend
[`FOUNDER-LOCK-consent-screens-2026-10-07.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-consent-screens-2026-10-07.md), which stays as history and is no
longer edited. It works like [`feedback-walk-and-chat.md`](feedback-walk-and-chat.md): §1 is the present, a
change is a line, and the design-lock check refuses a change to a file in `scripts/flow-pages.txt` without
this page.

§1 holds the lock as it stood on 2026-10-21, word for word, so every signed word stays as it was signed. Its
amendments follow its first text, and a later amendment wins over an earlier part. Paths in §1 are in the
backend repo unless they start with `src/`. Rewriting §1 in the present tense is open (§3).

---

## 1. The rules

`LOCKED 2026-10-07 · founder in chat: "the consent screens are great; but right now they are not scrollable like that in the real app; so lock it like that" · decisions log N60`

Clickable prototype (the reference for every screen, phone and desktop):
<https://claude.ai/artifact/TuMKSE2BH364ZQ1Eq4UMdd>, version 2. A copy of
the page as locked is kept in `docs/design/consent-screens-2026-10-07.html`.
The frontend's CLAUDE.md carried the rule ("Design lock — the consent
screens") until 2026-10-11; that text is now in
[`docs/history/CLAUDE-2026-10-11.md`](../history/CLAUDE-2026-10-11.md), and today's
CLAUDE.md points here.

### What it covers

1. **First time.** The welcome ("Enter the lab"), the agreement notice with
   the three documents (Terms of Service, Privacy Policy, How AI is used
   here; each "read ✓" once opened), each document's own screen ("Done
   reading" / "Back"), **Where do you live?**, **Three things to confirm**
   (the age tick, the sensitive-information tick, and the Personalised
   practice tick under its own "Optional" label; "Agree and continue" /
   "Do not agree"), and **Nothing was recorded** ("Go back" / "Read the
   documents again").
2. **Data & consent.** Personalised practice, Sensitive information in
   recordings, Help improve WillpowerLab, Your projects, Email and password
   (amended 2026-10-26, below), Delete my account
   with its confirm and the 7-day cancel, each with its confirm and its
   outcome line.
3. **Before each Take.** **Turn on the learning?** while the training
   switch is off: Skip is not remembered and it asks again before the next
   Take; Yes turns it on and it is never asked again.

### How it scrolls (the reason for the lock)

- Every step scrolls from its true top to its last button on any phone. A
  step taller than the screen starts at its top (the voice mark and the
  heading are never cut off) and its buttons are reached by scrolling.
- A document's screen keeps its title, its version and its buttons still;
  only the document's text scrolls. "Done reading" is always on screen.

### Words

Today's live words, unchanged, with one change signed by the founder in
chat the same day: the heading **"Two things to confirm"** becomes
**"Three things to confirm"**.

### Not locked (the prototype's stand-ins)

The dashed "Prototype stand-in" boxes (the recording and Ideal Text
screens), the two invented project names, the country list and its order
(the live list comes from the policy), the prototype's pop-up notes, its
"Learning: on/off" chip, and the bar above the phone.

### The rules (as for the other locks)

- Build these screens exactly as the prototype shows. Do not change their
  layout, flow or wording, and add no element or string the prototype
  doesn't show. If a task seems to need one, stop and ask the founder in
  the Navigation Panel, with a clickable prototype of the change.
- The legal documents' text and versions come from the active policy, never
  from the prototype's excerpts.
- These screens are the processing boundary in front of the live loop
  (LIVE LOOP): a change here must keep a person able to agree and record.

### Amended the same day: the settings page (founder, ST1 A, 7 October)

The Data & consent page follows the **settings page prototype**:
<https://claude.ai/artifact/4jDJsvBAquMUgaGkJgHR76> (copy in
`docs/design/settings-page-2026-10-07.html`). From the founder's message:
"remove the support from the hamburger and add it to the settings page with
just an email to contact@willpowerlab.com; remove the community btn; when
you are on the page show it orange text light orange background not only
when you hover over it; when I am on the Privacy policy and terms pages, and
I click back I am brought back to the lounge and I should have been brought
to the settings screen".

- A **Support** card (title and contact@willpowerlab.com) between Your
  projects and Delete my account.
- Privacy Policy and Terms of Service opened from this page show **Back**
  and return here; opened from anywhere else they keep "Back home".
- The ☰ menu has no Support and no Community row; the row for the page you
  are on stays orange on light orange, not only on hover.
- "Support" and "Back" are signed (ST1 A).

### Amended 2026-10-15: the 3.6 consent screens (founder, N73)

Approved on the clickable prototype <https://claude.ai/artifact/YCM8rQKkkwA2HKb4UYajeo>
(version 19; copy in `docs/design/consent-screens-2026-10-15.html`): "this
looks perfect". It replaces the 2026-10-07 prototype as the reference.

- **Documents:** on a computer each opens in its own fixed-height window,
  only the text scrolls; the button is **Continue** (was "Done reading"),
  with **Back** under it.
- **Where do you live?:** Poland, then **United States (California)**, then
  the rest by name.
- **Three things to confirm:** "I am 18 or older. *", "I agree that
  WillpowerLab may process my recordings. *", then **Can we make the product
  so much better for you?** / "We'd train our feedback on your practice."
  with an underlined **Read more** in the same colour / the tick **Yes,
  make it so much better.** (no asterisk, no "Optional" label). **Agree and
  continue** / **Do not agree**; no Back on this step.
- **Before a Take** (only while training is off) and the **Help improve
  WillpowerLab** card: the same question, sentence and Read more.
- **Read more:** Privacy section 4a in a window, **Continue** to close.
- **Data & consent:** the WhatsApp card (Remove, with its confirm) and Stop
  sharing on a shared Take, in the words shown with dashed outlines.

### Amended 2026-10-18: one screen (founder, in chat)

Approved on the clickable prototype "Condensed Consent Screens"
<https://claude.ai/artifact/6v4vEhppupQc9LC2tzbD6H> (version 6; copy in
`docs/design/consent-screens-2026-10-18.html`, the "One screen" flow): "dev
it!". It replaces the first-time walk of 2026-10-07 and 2026-10-15 as the
reference. The founder's words in the same chat, verbatim: "dont ask where
do you live just a choose chountry is neough and make it *", "shorten that
too!" (the sentence above the button), "bring it back to the center",
"so there is no need for the screen that asks you before te take, cause if
you don't agree, you don't enter" and "remove that screen".

- **One screen instead of six.** Welcome, then one acceptance screen: the
  voice mark, the agreement text, the three documents as underlined links in
  one centred row (**Terms of Service · Privacy Policy · How AI is used
  here**, each with "read ✓" once opened), a dropdown reading **Choose your
  country \*** (Poland, then United States (California), then the rest by
  name; nothing preselected except the person's own earlier answer), the one
  tick **"I agree that WillpowerLab may process my recordings. \*"**, then
  **Agree and continue** / **Do not agree**. No heading, no Back.
- **The age and the Terms are accepted by the button**, as the agreement
  text says; the age tick is gone. The recordings tick stays its own tick.
- **The documents open in a window** (the whole screen on a phone, a window
  in the middle on a computer): title, version and **Continue** stay still,
  only the text scrolls. They never gate the button. The AI-notice exposure
  row is written when that window opens.
- **No training question on the screen, and no "Turn on the learning?"
  before a Take.** That screen is removed from the app. The Help improve
  WillpowerLab card on Data & consent stays until the Privacy Policy says
  otherwise (below).
- **Nothing was recorded** is unchanged; "Go back" returns to the screen
  and "Read the documents again" opens the Terms window on it.
- Fits a 390×844 phone and a computer without scrolling; on a 375×667 phone
  it scrolls by under 50 px.

**The words above the button are the policy's `agreement_copy`** and change
only with a policy republish. The founder's approved text, three paragraphs,
is in `legal/phase1-2026.1/copy/agreement-3.2.txt`. Until a policy carrying
it is published the screen shows agreement 3.1 in the same layout. The third
paragraph (anonymised words from practice help improve the feedback for every
speaker) can go live only together with a Privacy Policy and Terms that make
training on anonymised text part of the service (today's 4a makes it a
consent); that is a counsel question (21-counsel-questions-2026-10.md).

Training wording v4's "the third thing to confirm" (amendment of 2026-10-15)
no longer applies to the first-time screen.


**Amended 2026-10-21 (backend N111): two prototypes join this page.** The policy update prompt,
<https://claude.ai/artifact/GPRRXaivyrZE2UjrRZY93K> (version 2; the founder approved it on 15 October,
"yeah approved"), as unified with every Lounge ask, <https://claude.ai/artifact/CzVL6JWK85tZDVpU9JRtgY>
(version 2). The code already follows both (`PolicyUpdate.tsx`, and the Lounge's `LoungeTopUpCard.tsx`).


### Amended 2026-10-26: Email and password (backend N190)

Approved on the clickable prototype <https://claude.ai/artifact/5tNVcdnq9PjkTyHHm9hzfT> (version 1; copy
in backend `docs/design/settings-email-password-2026-10-26.html`): "approved, implement it" (WIL-95).
Written in the present tense.

- **The card.** Data & consent has an **Email and password** card between Your projects and Support:
  **Email** with the address and **Change**; **Password** with dots and **Change**.
- **Change email.** **New email** and, for an account with a password, **Current password**, then
  **Send link** / **Cancel**. A link goes to the new address and a notice to the old one, and the card
  says "We sent a link to {new}. Your email changes when you open it." Opening the link changes the email
  and brings the person back to the card, through sign-in on a browser without a session: "Your email is
  now {new}." Only the newest link works, for 24 hours, once.
- **Change password.** **Current password**, **New password** ("At least 6 characters"), **Confirm new
  password**, then **Update password** / **Cancel**, and **Forgot password?** under them. A change signs
  the person out on their other devices, sends a notice and says "Password updated." Forgot password?
  says "We sent a reset link to {email}."; the link opens Set new password, which works as it does from
  the login page and signs out everywhere.
- **No password yet.** An account that signs in with Google or LinkedIn reads "You sign in with Google."
  (or LinkedIn) with **Set a password**, which says "We sent a link to {email}. Open it to set a
  password."; its email form has no password field.
- **Refusals**, under the form: "Enter an email address.", "That is already your email.", "That email
  already has an account.", "That password isn’t right.", "Password must be at least 6 characters.",
  "Passwords do not match." Anything else, and a link that no longer works, is the page's "Couldn’t save
  that. Try again." (the second until the founder words it, N190 item 6).
- **The emails** are the prototype's five, in its words (backend `services/email_account_security.py`).
- **The log.** Every request, change and wrong password is a row in the backend's security log, with the
  time, the IP address and the device. The speaker never sees it.
- `/change-password`, which nothing linked to, is gone; the card replaces it.

### Amended 2026-10-26: the page is called Settings (backend N196)

The founder in the Claude Code chat: "in the hamburger change the data & consent to 'settings'", then, for the
page's title and the recording screen's line, "yes change it to “Settings”". Written in the present tense.

- The ☰ menu's row for this page reads **Settings**, orange on light orange while you are on it.
- The page's title reads **Settings**, and so does the link to it on the screen for an account being deleted.
- The recording screen's line after the consent was withdrawn reads "Recording is off because you withdrew your
  consent. You can turn it back on in Settings."
- The address stays `/account/data-consent`; the documents already accepted keep their words. Where this page says
  "Data & consent" above, it means this page.

### Amended 2026-10-26: the WhatsApp card names the booked call (backend N207)

The founder in the Claude Code chat, choosing "Change the words": the booking form asks for no WhatsApp number,
and a booked call's reminder goes to the number saved on the account, so the card says so. Written in the present
tense.

- With a number saved, the WhatsApp card reads "We message {number} when your coach’s feedback is in and 10
  minutes before a booked call." Remove, its confirm and the card without a number stay as they are.

### Amended 2026-10-27: Personal answers in your plan (backend N211)

Approved on the clickable prototype <https://claude.ai/artifact/3GtUo7eVdf9SAhZQCDsTR7>:
"approved as drawn".

- A card on Data & consent, **Personal answers in your plan**, between Help
  improve WillpowerLab and WhatsApp (after AI version of your voice when that
  card shows). On: "Will asks how stressed and how ready you feel, what
  worries you, and how you feel before each Take. Your coach and Will use the
  answers to shape your plan." and **Turn off**, which asks first, in the shape
  of the training card's turn-off question: **Turn off personal answers?** /
  "We stop asking, and delete the personal answers you have given. Your plan
  stays." The outcome line, only once the answers are deleted: "Off. We
  deleted your personal answers." Off: "Off. Turn it on and Will asks how
  stressed and how ready you feel, what worries you, and how you feel before
  each Take." and **Turn on**.
- Hidden for anyone the backend answers `enabled: false` (the switch
  `PLAN_CONSENT_ENABLED`, off until Privacy 3.9 is published, or the plan's
  ring).
- Will's own ask for the same yes, in the Lounge, with **Read more** (Privacy
  section 4e in a window, **Continue** to close), is the plan's rule D5:
  [`the-plan.md`](the-plan.md).

### Amended 2026-10-27: WhatsApp as a way in (backend N214)

The founder in the Claude Code chat, on the clickable prototype <https://claude.ai/artifact/Dcf2FCyDs5c4Pb7BJc7oZ7>:
"Add it in Settings first", then, for the row, "use these words". Written in the present tense.

- **The row.** The Email and password card has a third row, **WhatsApp**. Off: "Sign in with your WhatsApp number
  too." and **Add**, which opens **Your WhatsApp number** with **Send code** / **Cancel**, then "Enter the code we
  sent you on WhatsApp" with **Continue** / **Cancel**, **Resend code** (after a minute) and **Use a different
  number**: the WhatsApp sign-up's words. A number without its country code gets the Lounge's line, a wrong code
  "That code didn't work. Try again.", anything else the page's "Couldn’t save that. Try again." On: "You can sign
  in with WhatsApp at {number}."
- **When it shows.** Once WhatsApp sign-in is on (`NEXT_PUBLIC_WHATSAPP_SIGNIN`), and always for an account that
  already signs in with WhatsApp.
- **A WhatsApp account.** No email row until it has an email, and no password row either, since its links go by
  email. The email comes from booking a call (the booking form's **Email**, "We'll send your calendar invite
  here."): it becomes the account's when its owner opens the "Confirm your new email" link, and the card then has
  its Email row, and a Password row that reads "You sign in with WhatsApp." with **Set a password**.
- The number added here is also the number the messages go to (backend N230, 28 October 2026: one number,
  checked once with the code, wherever it is first given).

### Amended 2026-10-28: the number field (backend N230)

Approved on the clickable prototype <https://claude.ai/artifact/W9JkYyK3pkwcurNd4itZwR>: "The design is great
too. Please implement it." Written in the present tense.

- **Everywhere a WhatsApp number is asked** (the WhatsApp sign-up and sign-in, this card's WhatsApp row, the
  Lounge's ask): the flag and the code first, then the number. Poland is chosen at the start, for everyone.
- **The list.** A tap on the flag opens it: Poland, then the United States, then every country A to Z, with
  **Search country or code** at the top, which finds a country by its name ("pol"), its code ("+44" or "44") or a
  short name ("uk", "usa"); **Cancel** closes it. Nothing found: "No country matches “{text}”."
- **Typing.** A full number pasted with + picks its country; a leading 0 is dropped; spaces appear as you type.
  **Send code** lights up only when the number is long enough for its country; too long: "That's too long for
  {country}. Check the country."
- **One number.** Wherever a number is first given, a code on WhatsApp proves it once; then it gets the messages
  and signs in with WhatsApp. A number another account already signs in with is refused: "That number already has
  an account." (backend N235).

### Amended 2026-10-28: the sign-up and sign-in pages open on the number (backend N232)

Approved on the clickable prototype <https://claude.ai/artifact/AsGCCSUvSDXQ8JiXzVGw8a>: "go, build both pages".
Written in the present tense.

- **Both pages:** the logo, with no line under it; the number field; one orange button, **Sign up with WhatsApp**
  or **Sign in with WhatsApp**, with the WhatsApp logo in white. Under "or", three small buttons of one size,
  **Email**, **LinkedIn** and **Google**, with their logos in black and white.
- **Sign-up:** the code, then "What should we call you?" with "Will and your coach use it." under it; the terms
  line under everything; "Already have an account? Sign in". **Email** opens **Sign up with email** (name, email,
  password and the terms box, as before).
- **Sign-in:** the code, then in, with no name step; "Don't have an account? Sign up". **Email** opens **Sign in
  with email** with **← Back**, the email and password, and **Forgot password?**. A number with no account gets
  "No account signs in with this number. Sign in another way, or sign up with WhatsApp."
- With WhatsApp sign-in switched off (`NEXT_PUBLIC_WHATSAPP_SIGNIN=false`), both pages are as before N232.
- **What the number is for** (backend N238): the sign-up page says nothing of its own. The Terms of Service and
  the Privacy Policy say that the number someone signs up or signs in with is also the number the messages go to.

### Amended 2026-10-29, again 2026-10-30: the welcome and its example (backend N273, N277)

Approved on the clickable prototype <https://claude.ai/artifact/MVyWmdoWUqisttfkW8qb8D>: "OK", then
"go and build it" (N277, which replaces N273's line and example; N273's prototype
<https://claude.ai/artifact/VqrCoZ3ddRkkiSayMfnTJp> is history).

- **Under the name**, two paragraphs, each broken in two: "Great presentations aren’t about slides. /
  They’re about a dream and the guts to deliver it." and "You bring the dream. / We’ll help you sound
  brave until you are 😏". On the landing and the in-app welcome, which are one composition. The
  2026-07-17 honest-positioning rule does not bind this line (N277).
- **Enter the lab**, then **See an example** with a small orange play mark. "Read blog posts" is gone:
  the posts sit right under the welcome.
- **See an example** opens over the whole page, with a ✕ at the top right that goes back. Its first line,
  level with the ✕, is **An example**. Then the founder's own Take, shared with his consent, as the walk
  draws it: his clip (`public/examples/founder-take-said.mp3`) and its words, "“All around actors, their
  costumes, all that was really great.”"; the walk's "That was good. But what if you said it more like
  this?" with **AI version of your voice** and its clip (`public/examples/founder-take-ai.mp3`); the tempo
  step's "That part went fast. 🏃 Let's try a little game." and "Tell me more about the actors, and keep the
  ball in the green."; and the Sniper (the pace scale), moving on a set pace, since the page has no
  microphone. **Try it with your talk** does what Enter the lab does. Nothing is agreed, recorded or sent.
- Nothing after the welcome changes.

## 2. In flight

One line per piece of work: `item · what it is · the rules it touches · where it stands · PR`. The session
doing it fills its line in its PR and deletes the line when the work is merged (the change goes to §6).

- **One "Messages" place** · on Data & consent: WhatsApp on or off with the number, email on or off, practice reminders on or off with their time, in place of the WhatsApp card, the email's unsubscribe links and the reminder in "Change your plan" · Data & consent · decided (backend N189), its design and words wait for the founder · BE #1360
- **The plan's questions after the acceptance** · "Agree and continue" opens the Lounge with the plan's questions, not the empty Lounge; the screen itself does not change · the flow after the screen · decided (backend N136, N146), not built · rules: [`the-plan.md`](the-plan.md) §1 B

## 3. Still open

- **§1 in the present tense.** §1 is the lock as written, with its amendments after it. The next change to
  this screen rewrites the part it touches in the present tense, the way the walk's page did (backend N107).

## 4. Where it lives

Frontend, guarded by `scripts/flow-pages.txt` (a change must change this page):

- `src/components/willab/Phase1AcceptanceFlow.tsx`
- `src/components/willab/WelcomeConsent.tsx`
- `src/components/willab/WelcomeExample.tsx` — "See an example" (N273, N277), with its two clips in `public/examples/`.
- `src/components/willab/PolicyUpdate.tsx`
- `src/app/account/data-consent/page.tsx`
- `src/components/account/`
- `src/components/legal/LegalBackLink.tsx`
- `src/components/AppMenu.tsx`
- `src/lib/appMenuLinks.ts`
- `src/lib/legal/dataConsentCopy.ts`
- `src/lib/legal/deleteAccountCopy.ts`
- `src/lib/legal/acceptanceSteps.ts` — the acceptance screen's steps ("Agree and continue", "Choose your country") (guarded since N111).
- `src/components/willab/Phase1AcceptanceGate.tsx` — the gate that shows the acceptance screen (guarded since N111).
- `src/components/willab/Mlc2FounderConsentGate.tsx` — the founder's consent gate (guarded since N111).
- `src/components/willab/ConsentAsk.tsx` — a consent ask: the training yes and the share choices (guarded since N111).
- `src/components/legal/PublishedPolicyText.tsx` — the published policy text in its window (guarded since N111).

Backend (`wilplus/backend-cursor`): the lock file this page replaces, [`docs/FOUNDER-LOCK-consent-screens-2026-10-07.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-consent-screens-2026-10-07.md) (history).

## 5. Prototypes

Every prototype link in §1, in the order it first appears:

- <https://claude.ai/artifact/TuMKSE2BH364ZQ1Eq4UMdd>
- <https://claude.ai/artifact/4jDJsvBAquMUgaGkJgHR76>
- <https://claude.ai/artifact/YCM8rQKkkwA2HKb4UYajeo>
- <https://claude.ai/artifact/6v4vEhppupQc9LC2tzbD6H>
- <https://claude.ai/artifact/GPRRXaivyrZE2UjrRZY93K>
- <https://claude.ai/artifact/CzVL6JWK85tZDVpU9JRtgY>
- <https://claude.ai/artifact/5tNVcdnq9PjkTyHHm9hzfT>
- <https://claude.ai/artifact/MVyWmdoWUqisttfkW8qb8D>
- <https://claude.ai/artifact/VqrCoZ3ddRkkiSayMfnTJp>

## 6. Changes

One line each, newest first: `date · N · what changed · PR`.

- 2026-10-30 · N277 · the welcome: two paragraphs under the name; "Read blog posts" goes; "See an example" opens over the whole page with the founder's own clip and words, the AI version of his voice, the tempo lines and the Sniper on a set pace (`WelcomeConsent.tsx`, `WelcomeExample.tsx`, `public/examples/`). Was: N273's description and a written example with its Ideal Text and feedback · BE #1509, FE (this PR)
- 2026-10-29 · N273 · the welcome says what you get: the page's description under the name, and "See an example" opening one example with "Try it with your talk" (`WelcomeConsent.tsx`, `WelcomeExample.tsx`). Was: "Public speaking excellence tool." and nothing to show · BE (N273 log), FE (this PR)
- 2026-10-28 · N238 · the sign-up page gets no line of its own on what the WhatsApp number is for; the Terms and the Privacy Policy say it gets the messages too · BE #1449, FE (this PR)
- 2026-10-28 · N235 · a number another account signs in with gets "That number already has an account." in this card's WhatsApp row · BE #1446, FE (this PR)
- 2026-10-28 · N232 · the sign-up and sign-in pages open on the WhatsApp number with one orange button; Email, LinkedIn and Google as three small black-and-white buttons under "or"; no line under the logo; "Will and your coach use it." under the name · BE #1441, FE (this PR)
- 2026-10-28 · N230 · the number field shows the country by its flag (Poland, then the United States, then A to Z, with search); the number added in this card's WhatsApp row gets the messages too · BE #1438, FE (this PR)
- 2026-10-27 · N214 · the Email and password card's WhatsApp row: Add, the number and the code; on, "You can sign in with WhatsApp at {number}."; a WhatsApp account's card has no email or password row until it has an email · BE #1420, FE (this PR)
- 2026-10-27 · N211 · the card "Personal answers in your plan" between Help improve WillpowerLab and WhatsApp: on and off, off asks first and deletes the personal answers; hidden until the backend's switch is on · BE #1416, FE (this PR)
- 2026-10-26 · N207 · the WhatsApp card names the booked call: "We message {number} when your coach’s feedback is in and 10 minutes before a booked call." · BE #1391, #1395, FE (this PR)
- 2026-10-26 · N196 · the page is called Settings: the ☰ menu's row, the title and the recording screen's line · BE, FE
- 2026-10-26 · N190 · Email and password on Data & consent: change email with a link, change password, Forgot password? and Set a password, the security log; `/change-password` goes · BE, FE
- 2026-10-26 · docs audit · the pointer to CLAUDE.md's "Design lock" section names its history copy; no rule changed · —
- 2026-10-21 · N111 · the policy update prompt and every Lounge ask, unified (both version 2), join §1 and §5, out of §3; the page also guards the consent files it missed (§4) · BE, FE
- 2026-10-21 · N107 · this page replaces backend `FOUNDER-LOCK-consent-screens-2026-10-07.md` as the place the rules live; the lock stays as history · BE #1241, FE #928
