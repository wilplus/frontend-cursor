# Customer requests: a client's customer asks, the answerer replies with a Take

> **Label: In force** · one of the rules, read in N95's order. Every doc and its label: [the master doc](https://github.com/wilplus/backend-cursor/blob/main/README.md) (N106).

One page for customer requests: a widget on a client's website (a head spa,
a shop, a clinic), the customer's short form, the request in the answerer's
chat, the answer recorded as a Take, the customer meeting the answer, the
booking or the purchase, and what the client's own model learns from it.
Started 2026-10-28 (backend N229) from the decisions log's entries N223 to
N228, folded here into the rules as they stand; each later entry about
customer requests is folded in the same way. The entries keep their
N-numbers and stay the record.

**Not built,** but for its first slice: the list of chats and a chat's
screen, built and the default for every signed-in person (backend N456;
was ring 6, feature `chats`). Decided and drawn; §2 says the order the
rest is built in.

**How this page works**

- It works like [`the-plan.md`](the-plan.md): §1 is the rules as decided,
  rewritten in place when a rule changes, with the old wording as one line in
  §6. Never a new file.
- Who said it is a suffix in brackets: the backend decisions log's number.
- The prototypes are the design (§5); the newest wins where two disagree.
  Where a prototype and this page disagree, say so in §3.
- No new words on screen without the founder's OK (Never 4): §1 K lists them.
  Every word a client's customer sees is new and waits.
- It borders three pages: the walk's page owns the Lounge's ask slot and the
  walk; the recording screens' page owns the recording screen; the Ideal Text
  page owns the Ideal Text. This page says where a request meets them.

---

## 1. The rules

### A · Who it is for

1. A **client** is a business that advises its own customers: the first
   testers are head spas and shops that sell hair and scalp care. The same
   loop serves any advice-led sale (N223).
2. A client is a **workspace**: a row owned by the client's account, with its
   name, its colour, its answerer, its salons, its WhatsApp sender and its
   documents. One backend, one database, row-level security by workspace; no
   service or deployment per client (N223 item 2).
3. The **answerer** (the client's trichologist, for example) is a normal
   WillpowerLab user. No new role, no new panel (N223 item 1).
4. The **customer** is a guest: no account, no app, no login. Their identity
   is the guest owner principal the app already has, and it remembers their
   number and their postcode (N223, N227).
5. The client is the **controller** of the customer's data, WillpowerLab the
   **processor**: a data processing agreement per client, and the consent on
   the form is given in the client's name (N223 item 8).
6. The widget is a **sales tool** first, judged by purchases and bookings,
   not by answer time. It becomes a support tool only once the client's model
   answers alone (N225).

### B · On the client's website

1. The client pastes one line before `</body>`:
   `<script src="https://willpowerlab.com/w.js" data-key="ws_…" async></script>`.
   The key works only from the domains listed on the workspace (N223 item 13).
2. The script mounts one element inside a shadow root, so the site's styles
   and ours never touch. The form opens as an iframe to our domain, so the
   photo, the number and the consent never pass through the client's page or
   its other scripts. The client's page learns only that a request was sent.
3. **The pill**, always at the bottom right: four words, "Ask our
   trichologist".
4. **The popup**, once per visitor, after a short delay, on the pages the
   workspace names: a title, one sentence, Ask, Not now. Not now keeps it away
   for 30 days.
5. One typeface, the system's; white and grey only. Quiet on a busy page.
6. **The form** is the client's product finder: a photo first, a few words
   optional, the customer's first name optional (N236 item 4), the mobile
   number, one consent tick. Send is live once there is
   a photo or words, a number and the tick. Then "Sent" and Done. Nothing
   stays on the client's site (N225 item 4).
7. Sending creates the customer's guest identity and one request row in the
   workspace, and the request lands in the answerer's chat.

### C · The request in the answerer's chat

1. **A list of chats** (N256): an answerer with customer requests opens her
   Lounge on a list, as WhatsApp does: Will pinned on top, then one chat per
   customer, with a circle holding the first letter of the name (no photo,
   N322 item 1), the first name and the question, the last message, an
   orange dot for a new message (no number, as the prototype draws it,
   N322) and a status (Waiting for you, Sent, Booked). Waiting for you
   comes first; filters All, Waiting, Sent, Done. Everyone has this list
   now, with colleagues and coaches as
   chats too (backend N274). **Everyone lands on the list (locked, N456):**
   every signed-in person, on the web and in the iPhone app, opens /chat on
   the list, Will first, even when Will's is their only chat; the loader,
   never Will's chat, stands in front until the list has answered, or, on
   a browser that read this person's list before, that list draws at once
   while the fresh one is read (`chats/chatsKept.ts`). No ring
   decides it. A link that opens something in Will's chat (the coach's
   feedback, the walk) still opens there, with the way back to the list;
   a join link opens the list (N357). Was: ring 6 only; everyone else, and
   a person whose only chat was Will's, opened Will's chat (N274). She is told of each request on WhatsApp:
   one message from WillpowerLab's number with a link to her chats (N236
   item 5).
   **As built** (N320, N321, N322; for everyone since N456), with a
   WhatsApp feel, under the WillpowerLab bar:
   - **Each row**, 76px, its divider starting after the circle: a 48px
     circle with the first letter of the name, its tint fixed per chat from
     a small palette (no photo); the name, who they are (muted, cut short)
     and the time on the right ("06:12" today, the date before, never
     "Yesterday"); under them, the last message on one line: its words, an
     emoji with its meaning ("👍 It's good"), or "🎤 Voice message".
   - **A new message** (its last message newer than the last time the
     person opened that chat on this device, kept per chat in the browser;
     unreadable storage reads as not new): the name bold, the line dark,
     the time orange-dark and a small orange dot. No number, ever.
   - **Will** is always the first row (N360), with his mark (the logo's
     three dots in a grey circle), his name and a pin, and under them his
     chat's newest line, new (bold, the orange dot) while it is his and
     came after his chat was last open on this device; open, or just come
     back from, it is seen (N457 item 2); then the chats, newest last
     message first. **Just joined through a link**
     (`/chat?with=<chat>`), the list opens, not a chat: the chat with the one
     who invited you is the row right under Will, marked new, its line their
     last message or, with none yet, "You joined thanks to {name}. Your
     first question starts the knowledge base you build together." (N496
     item 2; was N335 item 2's "You joined through {name}'s link. Only the
     two of you are in this chat."), kept on the row until the chat's first
     message (N488; was: blank once opened); opened, it takes its place with
     the rest (N357; was N348 item 1: that chat opened; was N357 item 1:
     above Will).
   - **Asked when they join** (N487, words signed in N491, N496, N502):
     when the one whose link it was set questions, the chat opens with the
     line "You joined thanks to {name}. A few questions first, then you
     build a knowledge base together." (N496 item 1) and their lines, one
     at a time, as their messages; the question waiting has its answers on
     your side (TapRow, N467), and a tap sends at once. "Yes" to "Are you in
     a hurry?" opens the date sheet ("When do you need to be ready?",
     Done); "Your deadline: {date}" shows under the answer. A question that
     takes more than one answer fills each one tapped, and "Send" stands in
     the bar's middle (N483 item 3). An emoji sent meanwhile leaves the
     question waiting, its answers under the newest message. The one whose
     link it was sees "{name} joined through your link." and, once the
     answers are in, one card, "{name}'s answers", which is also their
     row's line; never their own questions one by one (N487 item 7).
   - **Setting them, in Will's chat** (N487 items 2 and 3, N503): the
     first time "Add someone to chat with" opens (the list's "+" or its
     row), Will's chat opens instead, on his setup, one question at a time:
     "How far ahead do you like to plan?", the languages for someone who
     speaks two, "Anything else practical you'd like to ask?". His answers
     sit on your side ("Something else" first, which opens the box; the
     summary's "Change it" and "That's right" have none); typed words
     answer his question, and under "What should change?" the box stays
     open; Will understands the change however it is put (N535). The
     summary shows what someone new will see, your name in its top line,
     each question with its answers. "That's right" keeps them;
     "You're set." ends with "Copy my link ›" (then "✓ Copied") and "Your
     questions for people who join ›", which opens the summary again; under
     them Will says "All is set. You can now start practising." and the bar's
     middle is the next recording (N533, N532). After
     the setup, or before the backend can keep questions, the "+" opens the
     add sheet as before (`JoinSetup.tsx`, `Lounge.tsx`, `ChatList.tsx`).
   - **A person's chat**: the WillpowerLab bar goes; the chat's own top bar
     takes the top, full width: back, a 36px circle with the letter, the
     name and who they are. The messages start at the bottom, by the bar,
     with the day above them ("Today", otherwise the date) and the time in
     each bubble, bottom right; under a big emoji, its meaning and time
     ("It's good · 06:12"). The bubbles stay the Lounge's. **The bar**
     has one logic in every chat (N483, locked on "The Bar, Clickable"
     <https://claude.ai/artifact/WfwtMu9qc6aefz3zYUdPC2>, version 12, N498):
     your things on the left, the one thing to do now in the middle. Here
     the left is the "+", which asks them (below); the middle is the three emoji in the
     box; "Record your answer" when a marked question waits (below), with
     "Not now" a grey word under their question, which gives the emoji
     back until the chat is opened again and tells them nothing; or
     "Sending to {name}… {n}" with Undo, a bold word in the pill, while an
     answer or a question goes. No mic and no box: no voice notes and no typing (N483
     item 3; people never type, N335 item 4). Every send gives a short
     sound, and a small buzz where the device allows it. Was: the mic on
     the right, orange while your voice was awaited (N368, N460 items 1 to
     3; before that N341, the mic only then).
     Will's chat follows the same logic with its own left and middle: the
     stack, Your projects (a stack, not a "+", so "+" means add in every
     chat, N460 item 5), and the record button or, only when Will asks for
     words, the box ([the chat's page](feedback-walk-and-chat.md) B14).
     Every choice offered in a chat, a person's or Will's, follows the
     four rules of [the chat's page](feedback-walk-and-chat.md) J7 (N467,
     locked for the whole app): your answers on your side under the
     question, one orange answer look, "Not now", "Skip", "Cancel" and
     "Close" a grey word, a way to go a link with ›.
     In every chat the bubbles keep WhatsApp's rhythm (N469, [the chat's
     page](feedback-walk-and-chat.md) J8): two of the same side in a row
     2px apart, 12px where the side changes.
     Will deciding what is a question (N322 item 5) is not built. No new
     voice notes are made (N483 item 3); the ones already sent still play.
     A voice note is a bubble like the others, mine orange on the right,
     theirs grey on the left: the plan's small player (play, the drawn
     bars, the length) and the time bottom right. Under the player, once
     its words are ready, "Read it" opens them inside the bubble and "Hide"
     closes them; closed by default, for both people, so the voice is
     heard; a voice note with no words shows none, and the list keeps "🎤
     Voice message" (N331). Was: the mic recorded one with the one
     recording bar, up to two minutes (N321 item 2).
   - **An answer, as the one who asked meets it** (N355, N336 item 2,
     N333; built 2026-11-03 behind the same ring): their question first,
     as the thread already has it; then one message from the person who
     answered: the voice (the Take's own recording), the slides it was said
     over in a strip of small tiles under the player, the one being heard
     marked as it plays, and its words (the Take's, slide by slide) behind
     "Read it", closed. No Take number, no "What to do now" above it. The
     words and the strip come once the Take is processed; before, the voice
     alone. Then the bar of every chat. Not yet: the picks under it (the
     first as the one black button, the others as quiet rows), which wait
     for the picker (D1); the link to it from WhatsApp, which waits for the
     WhatsApp notice.
   - **The "+" asks them** (N483 item 4, N498; the locked prototype "The
     Bar, Clickable" v12). In every chat but Will's, a tap opens "Ask
     {name}", a sheet from the bottom built like "Add someone to chat
     with": the title, the black "Record your question" with the red dot,
     the three steps before your first question only ("1. Ask one thing ·
     A clear question gets a clear answer", "2. {name} answers · Out loud,
     when they have a moment", "3. It stays here · Play it again whenever
     you need it"), and Cancel; no line (N498 item 1). "Record your
     question" always opens the recording screens on the default
     presentation (Opening, Main points, Summary): a project of its own
     with no slides, named "To {name}", that never becomes your current
     one, the top line "To {name} · Slide {n} of 3"
     ([recording-screens.md](recording-screens.md)). Finish take brings you
     back to the chat with "Sending to {name}… {n}" and Undo, as an answer
     goes (below): the question goes to the backend once its Take is up
     (`POST /v2/chats/<id>/question`), held for what is left of the 5
     seconds, taken back by Undo, then "Sent" under it (N504 item 3). It
     reaches them as your voice message, with its words behind "Read it",
     marked for them to answer: their bar's middle is "Record your answer"
     with "Not now". Until you first tap it, while nothing else is asked of
     you and before you have asked anyone, the "+" is a filled orange
     circle, still: the one orange thing in the bar; once tapped it is
     plain (both kept on this device), and never while a question asked
     when you join waits for your tap ("Asked when they join", above). Was
     (N351, N460 item 4): the "+" swapped the
     bar for four tiles, Photos, Camera, Files and Someone else; they are
     off for now (N483 item 4). Photos and files already sent still show: a
     photo is a bubble with the image, mine orange on the right, theirs
     grey on the left, its time under it, and opens full size with a close
     ✕ and no words; a file is a bubble with a small red tile holding its
     extension ("PDF") and its name, and downloads through the backend. The
     list's line is "📷" after a photo and "📄 {file name}" after a file.
   - **A person's profile** (N366, the locked prototype "One bar" v12):
     in a person's chat, a tap on their circle or name in the top bar
     opens their profile, sliding over the chat, with back to it; your
     own opens from the top of the ☰ menu, at /profile. One page: a large
     circle (their photo, or the first letter), the name and who they are;
     "About"; "Photos", a grid of the photos shared in that chat, each
     opening full screen; "Files", each opening; "No photos yet." and "No
     files yet." when there are none. On your own: tap the circle for
     "Take photo", "Choose photo", "Delete photo" and "Cancel"; the pencil
     beside About opens it to type in (300 characters, a count, "Cancel",
     "Save"; "Edited today" under it the same day); "Edit" at the top right
     turns your name and who you are into fields too, and "Done" keeps
     them. A new name is the name your chats show. The only place in the
     app where a person types. Not yet: the About written from the setup's
     voice note (it waits for the setup).
   - **Block and Report** (N466, the locked prototype "One bar" with its
     Block and Report additions): at the foot of a person's profile, the
     one their chat's top bar opens (never your own, never Will's), a
     white box with two red rows (#B42318), "Block {name}" and "Report
     {name}", {name} as the chat shows it; once blocked, the first reads
     "Unblock {name}", not red. "Block {name}" opens a sheet like the add
     sheet (a handle, the title large, the grey line, full-width round
     buttons): "Block {name}?", "{name} can't send you messages or
     answers. {name} isn't told.", a filled red "Block", "Cancel"; then
     the toast "{name} is blocked." (a small black pill near the top,
     about two seconds). In that chat the bar (the "+" and the
     middle) is one grey pill, "You blocked {name}." with a white
     "Unblock" on its right; the earlier messages stay. Unblock, from the
     pill or the profile's row, asks nothing: "{name} is unblocked."
     "Report {name}" opens the same sheet: "Report {name}?", "The last five
     messages in this chat go to WillpowerLab, where a person reads them
     within a day. {name} isn't told.", a filled red "Report", an outlined
     red "Report and block", "Cancel"; then "Reported. Thank you." or
     "Reported and blocked." Each waits for the backend
     (`POST`/`DELETE /v2/chats/<id>/block`, `POST /v2/chats/<id>/report`
     with `{"block": …}`); a refusal changes nothing and shows nothing. The
     list's and the thread's reads say whether you blocked them
     (`blocked`). The founder reads each report in the CEO panel's
     "Reports", newest first: who reported whom, when, 🚫 when they
     blocked too, the five messages (each author with its words, an emoji,
     a voice note's words, "📷" or "📄 {file name}"), and "Mark as read";
     "No reports yet." when there are none (admin-only words).
   - **Will's chat** has its own top bar too, as every chat (N334 item
     1): back, his mark and "Will", over the Lounge; the WillpowerLab bar
     shows on the list only. Was (N322 item 4): the WillpowerLab bar with
     "‹ Will" under it. On a computer, the list and a person's chat sit in
     a phone-wide column in the middle.
   - **Back** (the iPhone's swipe, the browser's Back) from Will's chat or
     a person's chat goes back by one, to the list, however abrupt the
     swipe; from the list it goes nowhere, never off /chat to the sign-in
     page. In the iPhone app a swipe from the left edge goes back from a
     chat, after the finger. A person's chat slides in from the right and
     out to the right over the list; Will's chat opens as the list slides
     away to the left and closes as it comes back (none with less motion).
     Back on the list, it is where you left it, the row you came from lit
     grey for a moment (N378).
   - **Forward** (the iPhone app's swipe from the right edge of the list,
     the browser's Forward on the web) opens the chat you just came back
     from again, Will's or a person's, after the finger and sliding as when
     it opens; let go early and it slides back. Before you have left a
     chat, and over a screen opened on the list, it does nothing. The list
     keeps the WillpowerLab bar, the logo and ☰ (N436).
   - **Record your answer** (N321 item 4, N336, N342, N345, N361, N363):
     when the question waiting for your answer is one Will marked as about
     a product or a treatment (`meta.record_answer`), the middle of the bar
     is the black button with the red dot, "Record your answer", with "Not
     now" under the question (N483 items 3 and 5; was "Record an answer",
     N368). It
     makes the question a
     project of its own, one slide holding the asker's words, and opens
     the recording screens on it at once, the person's name alone at the
     top and "{name} asks" over the question, the clock counting up as any
     Take's (no five-minute cap, N486 item 4), no feelings check
     ([recording-screens.md](recording-screens.md) step 6). Finish take
     brings you back to the chat: in the middle of the bar, "Sending to
     {name}… {n}" counting down 5 seconds with "Undo" (N368). As soon as
     the Take is uploaded the answer goes to the backend
     (`POST /v2/chats/<id>/answer`, a voice message that plays the Take
     itself; any length, N486 item 4), which holds it for what is left of the
     5 seconds: until then the person does not see it, the list does not
     show it and no push goes, and leaving the app no longer stops it
     (N441 item 3). Under it, "Sent" with a check (N504 item 3; was "Sent to
     {name}"), a customer's
     too, until answers are delivered on WhatsApp (N441 item 4; then "Sent
     to {name} on WhatsApp", N342). The person gets just the answer, never
     its Take. A refused send stays in the bar, "Not sent" with "Send
     again", which sends the same Take at once (N441 item 1). Undo takes it
     back on the backend (`POST /v2/chats/<id>/answer/undo`); the Take
     stays the speaker's practice, and Will says first in their chat with
     him: "You took this one back, so {name} didn't hear it. Here's what I
     noticed, for practice." (N441 item 5). A Take that does not upload
     shows its error on the recording screens. Not yet: "Practise with
     Will" (N344), "Consult with someone first" (N343).
   - **The join link** (N308, N328, N335; built 2026-11-02 behind the same
     ring): the "+" at the bottom right of the list opens the add sheet, as
     redesigned (N367 item 3, the locked prototype "One bar" v12): a
     handle; "Add someone to chat with", large; "Send them your link, in
     any email or message. Whoever opens it joins you here."; the person's
     own link (/c/<token>) in a box with a link icon, to select; one big
     "Copy my link", which turns green with "✓ Copied" and closes the
     sheet; in the iPhone app, the share sheet beside it (N365 item 6);
     three tiles, "1. Paste it / in an email or a message you send
     anyway", "2. They open it / and join with their account", "3. You
     chat / Only the two of you are in it"; "Cancel" (N310 item 3, N367).
     Was: a grey box with the title, the line and the link, and Copy my
     link with a tick for two seconds. The link opens the join page, before
     any sign-in: who invites you ("{Name} asks you to join them on
     WillpowerLab"), "A chat with {name}", "Your own chat with Will, your
     speaking coach", "Nobody else can reach you here unless you open their
     link too.", one button, "Join" (N307), and "Opens in your browser.
     Nothing to install." (N335 item 2). Signed out, Join goes to sign in or
     sign up and comes back to finish; joined, /chat opens on the list of chats,
     Will's row first (N360) and the chat with the person who invited you
     right under it, marked new (N357; was N348 item 1, the chat itself): one chat for the two of them,
     however often either opens a link (N328). Will's first lines
     wait in Will's chat until they open it (N348 item 2). In that chat,
     above the messages, the one who joined reads "You joined through
     {name}'s link. Only the two of you are in this chat." A wrong or
     replaced link is the site's not-found page; your own link, or a link
     that stops working on the way, lands on /chat. Anyone signed in can
     join: the chats are everyone's, with no ring (backend N456 item 3, N457
     item 1; was: both people needed the ring). Not yet: "Invite by email" (N307), "Join with your
     {company} account" (it waits for a company to name; the button is
     "Join"), the ask link (N312).
2. **The customer's chat**: the request is the customer's bubble, with the
   photo, the words and the last digits of the number; the ask sits in the
   Lounge's footer slot, the grey card "{customer} asks for your advice."
   and Not now | Answer (walk page E1, D4). The customer is named by the
   first name they gave, or "A customer" (N236 item 4). Will's asks sit in
   the footer and what happened is a line in the middle; no Will bubble in a
   customer's chat.
3. **Will's chat** is the Lounge as it is today: her own Takes, each
   answer's Feedback walk, helper words and practice (N256 item 3).
4. **No group chat.** A team comes later as a shared queue: Assign to {name}
   on a customer's chat and a Team filter (N256 item 4).
5. Nothing sits between a Take and its Ideal Text: a request waits until the
   chain of the last Take is done. Not now brings it back after the next Take
   (Never 3).
6. One project per request, named by the customer's ask (N223 item 3).
7. A request unanswered for 24 hours sends one email to the founder and one
   to the client, the same pattern as `coach_moments_queue.reach_alarm`
   (N223 item 10).

### D · The answer is a Take

1. **What she sees, then what she recommends.** Answer opens a tap list in
   the lens, the same kind as the helper words. On top, what she sees in the
   photo: the condition chips and, for hair loss, the stage on its scale,
   about two taps (N240 item 2). Under them, the client's catalogue. Each
   pick is a slide (N226 item 1).
2. **The slides**: the customer's request and photo first, then each pick, in
   the order picked. "Just the request" records over the request alone.
3. **Her voice over the slides, camera off.** The locked recording screen as
   it is: the top line, the slides, the strip, Back, Next slide, Finish take.
   No video is sent or stored unless she adds one, as a coach may (N226).
4. The Take goes through the processing-authorization path and the pipeline
   like every Take: the transcript, the walk on how she said it, the Ideal
   Text one paragraph per slide (Never 5 holds: Take 2 replaces the text, the
   old one stays in the history).
5. **Send first, the walk after** (N236 item 2, N256 item 2): once the Take
   is processed, her answer lands in the customer's chat as her bubble with
   her voice and the Ideal Text card, and the footer asks at once "Send this
   answer to {customer} on WhatsApp?", Not yet | Send, with a grey card
   listing what the customer gets (her voice, the text, each pick with its
   price). A line in the middle when it went. A Take recorded in a
   customer's chat belongs to that customer, so no answer can reach the
   wrong person. Will's chat then says "Your answer to {customer} is sent.
   Your feedback is ready.", and the card there, marked new, opens the walk.
6. A Take 2 after sending does not change what the customer has: Will asks
   again, and only a second Send replaces it (N236 item 3).

### E · Where the customer meets the answer

1. Four ways, from the most to the least: the client's own app; **the web
   app** on the client's subdomain of willpowerlab.com; WhatsApp as the
   conversation; SMS. **Built now: the web app, with WhatsApp carrying the
   link and verifying the number** (N228).
2. The link comes by WhatsApp where that is the norm, by SMS where it is not:
   the number's country code decides; one line on the form switches; a failed
   WhatsApp delivery falls back to SMS, never both. The link opens the answer
   that was sent; it changes only when the answerer sends again (N236 item 3).
3. **The answer is a chat**, the Lounge's own parts in the client's colours
   (N228, N231): a top bar with the answerer's photo from her WillpowerLab
   profile and her name; then the thread: what the customer asked, as their
   bubble; the answerer's routine; her voice and her full answer; why the
   treatment; the treatment as a card.
4. **The treatment is a card with its price**, tappable like the Ideal Text
   card: its name, its length and the client's real price (for Invita, the
   Deep Scalp Treatment, 75 minutes, $138 to $148 by spa). Tapping it opens a
   sheet over the chat: what it is, the answerer's one line on why, what is
   included (from the client's own page), the length and the price by spa,
   and one button, Book · from {price} (N231 item 2, N234 item 1).
5. **One ask at a time, in the footer**, as the Lounge's: the answerer's
   question in the thread and its two equal buttons under it, Skip | Book. A
   field sits in a grey footer card (the ZIP), a pick is tall options (the
   spa, the day). A product recommendation asks Not now | Buy · {price} (N234 item 3); an
   answer that recommends nothing asks nothing (N225 item 2, N231 item 1).
6. **Booking in the client's own booking system** (N239 item 1): where (a
   ZIP or postcode, or "Use my location"), asked only now and once; the
   client's salons nearest first; then Book opens the booking system's own
   page for that treatment at that salon. For Invita, Fresha: the day, the
   time, the answerer's days and the payment are Fresha's. Whether Fresha
   gives the booking back to us, as the request's outcome, is checked before
   the build (N227, N231 item 3).
7. **Products in the client's own shop** (N239 item 2): Buy puts the product
   in the client's cart and opens its checkout. For Invita, Shopify: stock,
   shipping, taxes and refunds stay Invita's, and the order comes back to us
   as the outcome.
8. **Skip is not the end**: the answerer offers what she uses in the
   treatment for home, as a card, with Not now | Buy · {price}; Buy opens the
   client's checkout as in 7 (N231 item 4, N239 item 2).
9. **The message box whenever nothing is asked**: +, Type here, the mic, as
   in the Lounge. The customer can always write, add a photo or record a voice
   message to the answerer (N231 item 1).
10. **The money never passes through us**: the booking is paid in the
    client's booking system and the product in its shop; the receipts are
    theirs (N239 items 1 and 2).
11. Every bubble keeps a shape WhatsApp can carry (text, voice, photo,
   buttons, a list), so moving a client to WhatsApp is a change of transport,
   not of design (N228).

### F · Follow-ups

1. What the customer writes in the message box, or a reply to the text
   message, lands in that customer's chat as their bubble, and the chat goes
   back to Waiting for you. The answer comes back in the same chat, later; no
   instant answer until a model answers alone (N225 item 5, N231 item 5).
2. A follow-up may be typed in the customer's chat's message box, no Take;
   it goes to that customer only (N256 item 2). The pair is still recorded. Record instead makes it Take 2 of the same project. The
   first answer to a request is always a Take (N226 item 4).

### G · Data

1. The photo is kept in a private bucket under the workspace, read by signed
   URL only, and deleted by the retention cleaner 30 days after the answer.
   The pair keeps the text, not the photo (N223 item 9).
2. Geocoding a postcode is a provider call through the
   processing-authorization path (N227 item 4).
3. Counsel reads the DPA and the form's consent before the first client goes
   live. The WhatsApp provider is named in the DPA as a sub-processor.
4. Payments go through the client's own Stripe account; card details reach
   Stripe only, never WillpowerLab or the client's page (N234 item 4).

### H · What the client's model learns

1. **Three models from one Take** (N240 item 1): the eyes (the photo to
   what is seen: dry scalp, dandruff, oily, irritated, receding hairline,
   and the hair-loss stage on its fixed scale, Norwood 1 to 7 or Ludwig I to
   III, read the way the confidence model reads its 1 to 5); the plan (what
   is seen and the customer's words to the treatment and the product: her
   picks); the words (the plan to the answer in her voice: her Ideal Text).
   The reward is the outcome (booked, bought, not yet) and a follow-up photo
   after three weeks.
2. **The pair**: the request, the photo's labels, the answer schema, the
   final answer and its transcript, and the outcome (N224, N225 item 3).
3. **The labels**: her taps on the picker (D1). A second trichologist labels
   a sample blind for the frozen test set; two humans settle a label, as the
   label quorum does today (N240 item 2).
4. **The answer schema**: what was observed, which products, the routine,
   when to come in, which signs mean a doctor. Filled by her taps and picks
   before she speaks; the AI reads the rest from the transcript; the founder
   reads and corrects it in admin (N224 item 1, N226 item 2).
5. **No AI visible in the first version.** Drafts start in the background,
   blind, from about a hundred requests; she sees them only after the golden
   set passes, and always after she has answered (Never 2, N224 item 2, N240
   item 4).
6. **One platform** (N240 item 3): each client's models are learning
   surfaces in the pipeline that exists (labels, quorum, the split by
   customer, the sealed golden set, promotion by the founder, drift), each
   client's data and weights apart. New: training on photos, a vision
   training provider through the authorization path, the stage scored on its
   scale.
7. **Before any photo trains a model**: the customer's own yes to training,
   its retention, and counsel on whether naming a condition makes it a
   medical device in the US. Until then the eyes are advisory and seen only
   by the answerer (N240 item 5).
8. **A frontier model first** (N250 item 1): a client's AI starts on a
   frontier model (vision and language), with the client's catalogue and
   documents as its retrieval (embeddings per workspace in Supabase with
   pgvector, through the authorization path, N224 item 4) and the expert in
   the loop. A fine-tune comes only when the golden evaluation shows it stops
   improving; the pairs are collected from the first request.
9. **Autonomy**: the founder opens the door per workspace after the
   evaluation; the client turns it on per request type; a health red flag
   always goes to a person (N224 item 3).
10. **The client's IP is its data** (N250 item 2): the export, JSONL of the
    pairs with the labels, the schema and the outcome, the label list, the
    red flags, the documents and the golden set (N223 item 5); model weights
    only where a fine-tune was made.
11. **One kit, configured per client** (N250 items 3 and 4): the catalogue,
    the label list, the red flags, the channels, the connectors and the
    brand; no code written for one client. Each client's data and models
    are kept apart; learning across clients, anonymised, only where the
    client's contract says yes.

### I · Admin

1. The founder creates a workspace: the name and colour the customer sees,
   the answerer, the WhatsApp sender, the salons with the answerer's days and
   prices, the script tag to send to the client (N223 item 13). The client
   connects its booking system and its shop there once (for Invita, Fresha
   and Shopify), and the WhatsApp sender is the client's own (N239 items 1,
   2 and 4).
2. The workspace page lists each request's outcome in words, the counts, the
   documents, the DPA's state, and Export pairs. Nothing on it is a score
   about a person (N225 item 3).
3. Free for testers, a flag on the workspace; later tokens per answered
   request (N223 item 12).
4. **Before the first enterprise client** (N250 item 5): a template DPA and
   DPIA, a one-page model card per client surface, an audit log of every AI
   answer (the model version, the inputs, who approved it), a stated data
   region, and an "AI-assisted" label where the EU AI Act asks for one.

### J · Not in this version

- The client's own app and WhatsApp as the conversation (N228).
- Drafts, retrieval, fine-tunes and autonomy, until the pairs are there (N224).
- A weekly note to the client's owner, public answer pages, a check-in after
  three weeks: drawn or proposed, not decided.

### K · Words on screen

Approved by the founder as the prototypes draw them (N239 item 7, Never 4).
The pay sheet's words go with N239: paying is now the client's booking
system's and shop's. As the prototypes draw
them:

- The pill: "Ask our trichologist".
- The popup: "Not sure which treatment?", "Send a photo of your scalp. Our
  trichologist answers you within a day.", "Ask", "Not now".
- The form: "Ask our trichologist", "Add a photo", "Your scalp or hair. Only
  our trichologist sees it.", "A few words, optional", "Your first name,
  optional", "Mobile number, for the answer", the consent sentence (counsel writes the live one), "Send",
  "Sent", "Our trichologist answers you by text within a day.", "Done".
- The answerer's WhatsApp: "{customer}, a customer of {client}, asks for
  your advice. Open your Lounge:" and the link.
- The answerer's chats (N256, waiting for the founder's OK): "Chats", "All",
  "Waiting", "Sent", "Done", "Waiting for you", "Booked", "pinned", "Your
  Takes and feedback", "{customer} asks for your advice.", "Your answer",
  "Your answer to {customer} is sent. Your feedback is ready.", "Not now: it
  waits here, first in your chats.", "Sent. Your feedback waits in Will's
  chat.", "{customer} bought the {product}.", "{customer} booked the
  {treatment} at {salon}, {day}."
- The answerer's chat: "{customer}, a customer of {client}, asks for your
  advice.", "A customer of {client} asks for your advice.", "Gets your
  answer on WhatsApp", "Answer", "What do you recommend?", "Each one you pick
  is a slide while you talk. {customer} can book or buy it from your
  answer.", "Treatments", "To use at home", "{n} picked", "Record over {n}
  slides", "Just the request", "Camera off · your voice only", "The
  question", "At home", "At {client}", "Send this answer to {customer} on
  WhatsApp?", "She gets your voice, the text, and what you picked:", "Not
  yet", "Send", "Sent on WhatsApp · {time}", "Fine. It waits here until you
  send it.", "{customer} wrote back:", "Reply", "To {customer}", "Sent to
  {customer}", "{customer} booked the {treatment} at {salon}, {day}, and
  paid {price}.", "Record instead".
- The message: "Your trichologist answered you. Listen here:" and the link.
- The answer: "{name}", "Your trichologist at {client}", "You asked", "For
  the next three weeks", "For a dry, irritated scalp: buildup removal and
  Milbon hydration.", "Would you like to book it? {length}, {price}
  depending on the spa.", "Skip", "Book", "Where are you? So I book you at
  the {client} nearest to you.", "Your ZIP code", "Use my location",
  "Continue", "Nearest to {zip}. I'm at each on these days.", "Which day in
  {salon}?", "Your booking", "Change", "Pay {price}", "What's included",
  "Book · from {price}", "Pay {client}", "Total", "Pay with card", "Paid to
  {client} through Stripe.", "Paid {price}", "Booked and paid", "Receipt",
  "Add to calendar", "Buy · {price}", "Send to", "Paid, on its way",
  "Directions",
  "See you there. Write to me here if anything changes.", "No problem. If
  coming in isn't easy, you can start at home:", "What I use in the
  treatment, for every second day at home.", "Not now", "Write to me here once you've tried it, or
  whenever you like.", "Of course. Write to me here whenever you like.",
  "Type here", "Sent to Ariel. She answers here, usually the same day."
- The chats between people, as built (N320 item 4, N322; for everyone, N456):
  "You", "Customer · Invita", "Your colleague · Invita", Sarah's and
  Ariel's lines, "Will", "Only 👍, 👀 or 🙏 for now.", "Today", "🎤 Voice
  message", the dates and the clock times.
- Under a voice note's player (N331): "Read it", "Hide".
- The "+" in a chat with a person (N337, N351): "Photos", "Camera",
  "Files", "Someone else", "Cancel", and "Add to your chat with {name}" as
  its name for a screen reader. The list's "📷" and "📄 {file name}" are an
  emoji and the person's own file name.
- Block and Report (N466): "Block {name}", "Unblock {name}", "Report
  {name}", "Block {name}?", "{name} can't send you messages or answers.
  {name} isn't told.", "Block", "Cancel", "{name} is blocked.", "You
  blocked {name}.", "Unblock", "{name} is unblocked.", "Report {name}?",
  "The last five messages in this chat go to WillpowerLab, where a person
  reads them within a day. {name} isn't told.", "Report", "Report and
  block", "Reported. Thank you.", "Reported and blocked."; in the CEO
  panel only, "Reports", "Mark as read", "No reports yet.".

---

## 2. In flight


Built for every signed-in person (backend N456, 2026-11-03; was ring 6,
feature `chats`, the founder only, 2026-11-02): the
list of chats in front of the Lounge (C1: Will pinned, for a coach their
queue's row right under him (N521, the coach panel's B1), then each chat's
letter circle, title, subtitle, time and last message, newest first, a new
message, an emoji from the other person included and your own never, with
the look locked for the whole app, N500: the name bold, the time orange, the
line bold and orange, the orange dot; with nobody yet, Will and "Add someone to
chat with", on the web as in the iPhone app, N401) and a
chat's screen, the conversation only, under its own top bar in the
WillpowerLab bar's place, with the day and each message's time, the
three emoji in the locked bar (N298, N302, N305, N306, N311, N321, N322;
the mic and its voice notes went with N483, the older ones still play). Off, /chat is the Lounge as it is. Not yet: passing on, the
status and the filters. Built since: the join link, the add sheet and the join page
(C1, N308, N328, N335); the "+" in a chat with a person, which asks them
("Ask {name}", C1, N483 item 4, N498; was Photos, Camera, Files and Someone
else, N351); "Record your answer", a marked
question answered with a Take that goes back to the chat (C1, N361,
N363); Block and Report from a person's profile, the reports in the CEO
panel (C1, N466). Built behind the backend's switch for sending (`TAKE_SEND_ENABLED`,
off until the Privacy text for it is signed, N479 item 1): a Take sent to
you is the sender's message in your chat with them, "{name} sent you Take
{n}" with the Take's tile (its length, "Take {n}", the project) and "Open
Take" under it, which plays its recording and shows its words slide by
slide behind "Read it", as an answer does, and never its Ideal Text,
feedback, moments or levels; the list's line says "{name} sent you Take
{n}"; the sender's own is the tile with "Sent" (N504 item 3) (C1, N470 item
4, N479 item 8; the prototype "Specialist Side" flow 4).
There is no typing outside Will's chat (N298 item 4).

Nothing else built. The order of the build, each slice proving one thing (N223
item 15, N225):

1. The workspace, the widget and the popup, the request card in the chat, the
   link by WhatsApp to a plain answer page with the dock's one action and the
   request's code.
2. The answer as a Take: the picker, the slides, the walk, the send ask.
3. The answer as a chat, the booking in the thread with the nearest salon,
   the follow-up, the 24-hour alarm, the photo's retention.
4. The answer schema, the outcome on the pair, the admin page and the export.
5. At about a hundred pairs: retrieval and blind drafts. At two hundred: the
   fine-tune surface, the golden set, the founder's door, the client's switch.

## 3. Still open

- **The DPA and the form's consent**, for counsel, before the first real
  customer; what the client pays, before going live (N239 item 6).
- **The locked screens it touches**, each needing its own page's line when
  built: the request as an ask in the Lounge (walk page E1); the picker in the
  lens, with what she sees on top (walk page); the slides from the picks on
  the recording screen (recording screens' page); the send ask on the Take's
  card, before the walk (walk page D4, N236 item 2); the Lounge as a list of
  chats, one chat per customer and Will's chat (walk page E1, N256).
- **Where the prototypes are older than a decision**: the Mila prototype's
  answer page is a page with cards, not the chat (N228). The Invita
  prototypes follow N239 and N240.
- **The colours**: the widget is white and grey (the founder, 28 October); the
  answer chat is in the client's colours (the founder, the same day). Both as
  drawn, until the founder says otherwise.
- **Ours, before the answerer's side is built** (N236 item 6): many requests
  at once (one ask at a time, or a list); the price by spa on the slide;
  whether an answer uses her tokens; fixing a word before sending; Shopify's
  cart link and its order coming back as the outcome (N239); the US SMS
  fallback's provider.
- **Ours, before any photo trains a model** (N240 item 5): the customer's yes
  to training and its retention, counsel on the US medical-device question,
  the vision training provider.
- **For the strategic call with Invita** (the founder, 28 October 2026: no
  answers yet, asked on the call):
  1. Are the Milbon products sold online, or only at the spas? Invita's
     Shopify sells one care product, the Scalp Scrubber ($20), which the
     prototypes use.
  2. How many requests a month does Invita expect? It decides how soon the
     photo model can learn.
  3. Who is the second trichologist who labels a sample of photos blind, for
     the test set?
  4. Does Fresha give the booking back to us (an API, a webhook or an email),
     so the chat and Ariel know it was booked? Without it the model learns
     from purchases only.
  5. How fast must Ariel answer (the widget promises "within a day"), and
     who answers when she is away?
  6. Who keeps the list of treatments, products and prices right: Invita, or
     us from its site?
  7. The photos: one or several, kept how long, and who at Invita may see
     them?
  8. One inbox for several trichologists, or Ariel's Lounge only?
  9. Ariel's account: does Invita invite her, or do we; her photo and name
     as customers see them?
  10. Invita's WhatsApp sender: is it set up, and who submits Meta's message
      templates?
  11. What would make this worth it in three months, and today's numbers
      (bookings from the website, online orders a month)? (N250 item 6)
  12. What does Invita already keep from past consultations (notes, photos,
      before and after photos, forms), and how much?
  13. Does Invita look at the scalp through a camera during treatments, and
      keep the images?
  14. Does Ariel use a form or her own way of grading a scalp?
  15. What must an answer never say, and when must Ariel send someone to a
      doctor?
  16. Who owns the photos, the answers and the AI trained on them, and may
      WillpowerLab learn from them, anonymised?
  17. Which languages do customers write in?

## 4. Where it lives

The list of chats and a chat's screen (§2): frontend
`src/components/willab/chats/` (mounted by `WillabSurface.tsx` around the
Lounge, which it leaves as it is; the door's `navbar` tells it to hide the
WillpowerLab bar while any chat is open, Will's included (N334); `chatTime.ts` the times and
the day, `chatOpened.ts` what is new; a voice note plays with
`plan/VoicePlayer.tsx`), `src/services/api/chats.ts` and the BFF routes
`src/app/api/v2/chats/` (a voice note's playback
`[chatId]/messages/[messageId]/audio/`, in byte ranges); the backend's
`/v2/chats` routes and `GET /v2/chats/<id>/messages/<messageId>/audio`
(`POST /v2/chats/<id>/voice` is no longer called, N483 item 3). The "+"
asking them (N483 item 4): the sheet in `AskSheet.tsx`, the orange "+" in
`ChatThread.tsx` (`EmojiBar`), the question's project, sending and Undo in
`src/lib/willab/chatAnswer.ts` (`asks`, `askedBefore`, `plusSeen`), the BFF
route `[chatId]/question/` and the backend's `POST /v2/chats/<id>/question`.
Photos and files already sent: their bubbles in `ChatThread.tsx`, the BFF
route `[chatId]/messages/[messageId]/file/` (through `chatUpload.ts`) and
the backend's `GET /v2/chats/<id>/messages/<messageId>/file` (table
`chat_message_files`); sending them stopped with N483 item 4 (the BFF
routes `[chatId]/photo/` and `[chatId]/file/` are gone).
Block and Report (N466): the rows, the sheets, the blocked bar and the toast
in `BlockReport.tsx` (the profile's foot in `Profile.tsx`, the bar in
`ChatThread.tsx`); the BFF routes `[chatId]/block/` and `[chatId]/report/`;
the CEO panel's Reports in `src/components/ceo/CeoReports.tsx`, read through
`src/app/api/v2/admin/ceo/chat-reports/` (so the CEO host serves it) from the
backend's `GET /v2/admin/chat-reports` and
`POST /v2/admin/chat-reports/<id>/handled`.

The rest is not built. Where it will live, so §1 has a home from the first PR:

- Frontend: `public/w.js` (the widget), `src/app/w/[key]/` (the form the
  widget opens), `src/app/a/[token]/` (the answer chat), the answerer's ask
  and picker beside the Lounge's other asks, the workspace page under
  `src/app/admin/`.
- Backend: `services/customer_requests.py`, `routes/v2/public_requests.py`
  (the widget's and the answer page's public routes), the workspaces,
  requests and salons tables in one migration, the WhatsApp link through
  `services/whatsapp_notify.py`.

## 5. Prototypes

The design is the prototype; the newest wins where two disagree. Every
prototype is kept in the backend repo as files, so it survives without the
tool it was drawn in (backend N229): its own HTML, which runs in any browser
(open it from a checkout of the repo), and a PDF of every step. The
claude.ai link beside each is a convenience, never the only copy.

The folder: [`backend docs/design/customer-requests-2026-10-28/`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/).

- **The bottom bar, one logic in every chat** (2026-11-04, N483, locked; the
  newest for the bar in both chats): Will's chat in every state, and a chat
  with a person: joining with closed questions, the orange "+", "Ask
  {name}" the first time and after, the default presentation on the
  recording screens, sending with Undo, the answer, "Record your answer"
  with "Not now", "Not sent" and blocked (23 pages). PDF
  [`11-the-bar-clickable.pdf`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/11-the-bar-clickable.pdf) ·
  HTML [`the-bar/the-bar-clickable.html`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/the-bar/the-bar-clickable.html) · link
  <https://claude.ai/artifact/WfwtMu9qc6aefz3zYUdPC2>.
- **The answerer's side, in her Lounge** (2026-10-29, N236, N240, N256; the
  newest for the answerer): Ariel at Invita, from the WhatsApp message to her
  list of chats, Sarah's chat with the request, the photo, what she sees and
  the picker of Invita's treatments and the Scalp Scrubber, the recording
  over the request and her picks, processing, her answer and the send ask
  in Sarah's chat, Will's chat with the feedback waiting, the walk, the
  Ideal Text, Sarah's reply and her typed answer, the purchase and the
  booking, the list as it changes, and the questions still open (23 pages). PDF
  [`6-answerer-side-in-her-lounge.pdf`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/6-answerer-side-in-her-lounge.pdf) ·
  HTML [`ariel/ariel-lounge.html`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/ariel/ariel-lounge.html) · link
  <https://claude.ai/artifact/CeeWQpvUrZT31aj8Lm3Fsa>.
- **The customer's side, on a phone** (2026-10-28, N227, N228, N231, N236,
  N239; the newest for the customer): invitaheadspa.com with the widget, the
  popup, the form, the text message, the answer as a chat, the treatment card
  and its sheet, the nearest spa opening its Fresha page, Skip and the Scalp
  Scrubber in Invita's Shopify checkout, the message box (14 pages). PDF
  [`2-customer-side-on-a-phone.pdf`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/2-customer-side-on-a-phone.pdf) ·
  HTML [`customer/invita-flow.html`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/customer/invita-flow.html) · link
  <https://claude.ai/artifact/1u6UrevnTpo9jRZdfa9w83>.
- **The widget on a desktop page** (2026-10-28): PDF
  [`3-widget-on-a-desktop-page.pdf`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/3-widget-on-a-desktop-page.pdf) · HTML
  [`customer/invita-site.html`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/customer/invita-site.html) · link
  <https://claude.ai/artifact/EKj695hBzBansc1CzVZNdV>.
- **The answerer's side and admin** (2026-10-27, N223 to N227; older than
  N228 and N236, kept for the admin page): the request in the Lounge, the picker, the
  recording, the lens, the Ideal Text, the send ask, the typed follow-up, the
  workspace page. PDF
  [`1-answerer-side-and-admin.pdf`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/1-answerer-side-and-admin.pdf) · HTML
  [`answerer/customer-requests.html`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/answerer/customer-requests.html) ·
  link <https://claude.ai/artifact/4G7zK3sPsSfWdgyKxJhcGJ>.
- **How a client installs it** (2026-10-28): PDF
  [`4-how-a-client-installs-it.pdf`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/4-how-a-client-installs-it.pdf) · HTML
  [`install/mila-site.html`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/install/mila-site.html) · link
  <https://claude.ai/artifact/MAeKv5P7iZYfmnNMfm7gHV>.
- **Who gets what**, the value proposition canvas (2026-10-27, reference):
  PDF [`5-value-proposition-canvas.pdf`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/5-value-proposition-canvas.pdf) ·
  HTML [`canvas/value-proposition-canvas.html`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/canvas/value-proposition-canvas.html)
  · link <https://claude.ai/artifact/4HnpmJHfMzqnFkXpVQUAhL>.

## 6. Changes

One line each, newest first: `date · N · what changed · PR`.

- 2026-11-06 · N535 · C: under "What should change?" Will understands the change however it is put (the model, under the person's processing authorization). Was: only a few fixed phrasings, so "make the choices polish and english and french" got "I couldn't tell what to change" · BE N535 (wilplus/backend-cursor#1791), FE (this PR)
- 2026-11-06 · N533 · C1: at the end of the join setup, under "You're set." and its two links, Will says "All is set. You can now start practising." (backend `services/join_setup.py` writes it as his own line, `{"step": "say"}`, drawn by `JoinSetup.tsx` as any of his lines); the summary opened again ends at "Saved. …" as before. Was: "You're set." was Will's last line · BE N533 (#1787), BE #1789, FE (this PR)
- 2026-11-05 · N521 · C1: for whoever may hear speakers, a row right under Will opens their queue; its rules are the coach panel's B1 · BE #1762, FE (this PR)

- 2026-11-04 · — · C1: the list draws at once: the list this browser last read for the signed-in person shows while the fresh read is on its way, then the fresh one takes its place (`chats/chatsKept.ts`, kept for that person only and gone when nobody is signed in); a failed read keeps the list there is. The backend reads the list's parts side by side (BE `services/chats.py` `list_chats`). The first open on a browser still waits under the loader (N456). Was: the loader every open, about 0.65 s; a failed reload emptied the list · BE #1755, FE (this PR)
- 2026-11-04 · N485, N486, N493, N504, N512 · C1: a matched Take that reached you is an asking chat in your list, under Will's row: its pseudonym and role, "Asks you about {topic}", new. Opened, it shows "{Pseudonym} is asking for what you know. Your answer starts a knowledge base you build together." and "It's about {…}.", never a name, with "Open Take" in the bar's middle (black, no dot) and "Not now" under the question. Open Take shows the asker's name and the Take, open (its recording and its words), with "Record your answer": the answer is recorded over the Take's own slides when the backend gives their titles (else its one slide, the topic), held five seconds with "Sending to {name}… {n}" and Undo on the matching's own routes, and then the chat with the asker is made and the list reads it. "Not now", before or after Open Take, removes it and tells nobody (`InquiryThread.tsx`, `takeMatches.ts`, BFF `take-matches/`, `chatAnswer.ts` `inquiry`, `useChats.ts`, `ChatList.tsx`). The speaker's side: after a Take, once, when someone new fits it, the page that picks who a Take goes to opens once more with that one person, never before the walk is over (it waits while a walk screen is up): "Someone new might be a good match for this Take.", "{Pseudonym} works on what you're practising. You could learn from each other. Send it to them too?", the pseudonym, the role and "Not in your chats yet", with Send and Not now (✕ changes nothing; asked once per Take) (`TakeMatchSuggestion.tsx` from the latest Take's card, `ReportCard.tsx`; BFF `takes/[sessionId]/match`, `take-matches/[matchId]/send`, `close`). Off until the backend's `take_match` ring is on: no asking chats and no suggestion then · BE #1712, N512 (#1750), FE (this PR)
- 2026-11-04 · N493, N504 · C1: a Take someone sends you arrives open in your chat with them: its tile, its recording and its words slide by slide behind "Read it", with no "Open Take" (`ChatThread.tsx` `ChatTakeBubble`, one load per message shared with the bar, `loadChatTake`). Newest, it asks for an answer: "Record your answer" in the bar's middle with "Not now" under it, and the answer is recorded over the Take's own slides, by their titles ([the recording screens](recording-screens.md), amendment of 4 November). A Take's tile is its first slide, small, with its length and no play mark: no video. Under your own sent Take or answer the line is "Sent" (was "Sent to {name}"). "Not now", under a Take or a question, still tells nobody; the system keeps it once as behavioural data (`declineInChat`, `POST /api/v2/chats/{id}/messages/{message}/not-now`), and the founder reads how often and the newest on the person's admin page, under their Takes (`NotNowHistory.tsx`, BE N504 item 2, #1744). What stops: "Open Take" in a chat you already have; the dark tile with the white play mark; the name in the sent line · BE N493 (#1728), N504 (#1740), BE (#1744), FE (this PR)
- 2026-11-04 · N487, N503 · C1: the first time "Add someone to chat with" opens, Will's chat opens on his setup of the questions everyone who joins is asked, one at a time, answered by tapping or typing after "Something else"; the summary with "Change it" and "That's right"; "You're set." with "Copy my link ›" and "Your questions for people who join ›" (`JoinSetup.tsx`, `Lounge.tsx`, `ChatList.tsx`). Nothing stops: after the setup the "+" opens the add sheet as before · BE (wilplus/backend-cursor#1742), FE (this PR)
- 2026-11-04 · N483 item 4, N498 · C1, §2, §4: the "+" asks them: "Ask {name}", a sheet built like "Add someone to chat with", with no line, the black "Record your question", the three steps before your first question only, and Cancel; the question is recorded over the default presentation ("To {name} · Slide {n} of 3") and sent as an answer is, with Sending, Undo and "Sent to {name}", marked for them to answer ("Record your answer"); the "+" orange until first tapped (`AskSheet.tsx`, `ChatThread.tsx`, `chatAnswer.ts`, BFF `[chatId]/question/`). What stops: the four tiles, sending photos and files, and Someone else from a chat (the list's "+" still opens the add sheet); photos and files already sent still show · BE N498 (#1733), BE (question route PR), FE (this PR)
- 2026-11-04 · N487, N496, N502 · C1: a chat made through the link of someone who set questions asks them, answered by tapping (TapRow; several, then "Send" in the bar's middle; "Yes" to the hurry opens the date sheet), with "Your deadline: {date}" under the answer; the owner sees "{name} joined through your link." and one card, "{name}'s answers", also on their row. The joined line is now N496's, in the chat and on the row. What stops: the line "You joined through {name}'s link. Only the two of you are in this chat." · BE N487 (#1717), N496 (#1732), N502 (#1734), BE #1739, FE (this PR)
- 2026-11-04 · N500 · C1: an emoji from the other person lights up their row like any new message, your own message never does, and every new row, Will's included, has the look locked for the whole app: the name bold, the time orange, the last line bold and orange, the orange dot; the open list reads the chats again every 20 seconds and on coming back to it (`ChatList.tsx`, `chatOpened.ts`, `useChats.ts`). Was: the line dark and not bold, your own message could read as new, and the list read the chats only when it first loaded · BE N500 (wilplus/backend-cursor#1737), FE (this PR)
- 2026-11-04 · N488 · C1: the row of a chat you joined through someone's link keeps "You joined through {name}'s link. Only the two of you are in this chat." until the chat's first message, read from the list's `joined_through` (`ChatList.tsx`); only the one who joined sees it. Was: the row went blank once the chat was opened · BE N488 log (#1724), BE (#1729), FE (this PR)
- 2026-11-04 · N483 · C1, §2, §4: the bar in a chat with a person has one logic, as in every chat: the "+" on the left; in the middle the three emoji, "Record your answer" when a marked question waits, with "Not now" a grey word under their question (it gives the emoji back until the chat is opened again and tells them nothing), or Sending with Undo. What stops: the mic and new voice notes (older ones still play; `sendChatVoice` and the BFF route `[chatId]/voice` are gone), the mic's orange, "Record an answer" (now "Record your answer"). Still in flight: the "+" asking the person ("Ask {name}") · BE N483 (#1718), FE (this PR)
- 2026-11-04 · N486 · C1: an answer has no five-minute cap: the recording screens time it as any Take, counting up, and the backend takes an answer of any length. Was (N363 item 3, N441 item 2): up to five minutes, the clock counting down from 5:00 and finishing by itself · BE (cap PR), FE (this PR)
- 2026-11-04 · N470, N479 · C1: a Take someone sends you is their message in your chat with them, "{name} sent you Take {n}" with the Take's tile and "Open Take", which plays its recording and shows its words slide by slide behind "Read it", nothing else of it; the list's line says "{name} sent you Take {n}"; your own sent Take is its tile with "Sent to {name}" (`ChatThread.tsx` `ChatTakeBubble`, `ChatList.tsx` `lastLine`, `takeSends.ts`). No passcode in the list of chats: a person's link is the only way in (N471 item 2, N479 item 4). Behind the backend's switch, off until the Privacy text is signed. Was: a chat had no Take messages · BE N470 (#1702), N479 (#1704), BE (send PR), FE (this PR)
- 2026-11-04 · N469 · C1: the bubbles keep WhatsApp's rhythm in every chat, Will's included: 2px between two of the same side, 12px where the side changes ([the chat's page](feedback-walk-and-chat.md) J8). Was: 8px between every row · BE #1700, FE (this PR)

- 2026-11-04 · N467 · C1: every choice in a chat, a person's included, follows the chat page's J7, locked for the whole app; Will's chat starts at the bottom, as the chats with people do · BE N467 log (#1695), FE (this PR)
- 2026-11-04 · — · C1: the rules text brought in line with N456 and N457: anyone signed in can join through a link, no ring; no rule changes · docs (this PR)
- 2026-11-04 · N466 · C1, K, §2, §4: Block and Report: at the foot of a person's profile (never yours, never Will's), "Block {name}" and "Report {name}" in red; Block asks in a sheet ("Block {name}?", a red "Block", "Cancel"), then "{name} is blocked." and, in that chat, the bar is one grey pill "You blocked {name}." with "Unblock", which needs no sheet ("{name} is unblocked."); Report asks in a sheet ("Report {name}?", a red "Report", an outlined red "Report and block", "Cancel"), then "Reported. Thank you." or "Reported and blocked."; the founder reads the reports, newest first, with the five messages and "Mark as read", in the CEO panel's Reports (`BlockReport.tsx`, `Profile.tsx`, `ChatThread.tsx`, `CeoReports.tsx`). Was: no way to block or report someone · BE (next PR), FE (this PR)
- 2026-11-04 · N460 · C1: the bar made calmer: in a person's chat the mic is a bare icon at rest and orange without pulsing when your words are awaited, quiet beside "Record an answer"; Undo and Send again are bold words in their pill; the "+" turns into a ✕ in its place to close the tiles, and "Cancel" goes; in Will's chat, Your projects is a stack icon. Was: the mic in a grey circle, orange and pulsing beside Record an answer too; Undo and Send again white pills; Cancel under the tiles; a "+" for Your projects (`ChatThread.tsx`, `Lounge.tsx`) · BE (N460 PR), FE (this PR)
- 2026-11-03 · N457 · C1: Will's row shows his chat's newest line, read from the Lounge's thread underneath (words only: a card, a walk step or a status is not a line), new with the bold name and orange dot while it is his and newer than the last time his chat was open on this device; just joined through a link, it is "Your first Take is five questions…" above the inviter's chat. Joining works for anyone since the chats are everyone's (N456). Was: Will's row had no line · FE (this PR)
- 2026-11-03 · N456 · C1, §2, K: the list of chats and every chat's own top bar are the default for every signed-in person, on the web and in the iPhone app, locked (backend docs/LOCKS.md, "The chats, all of a piece"): no ring decides them (`useChatsOn` is the session; backend `chats.enabled` every signed-in person); the loader, never Will's chat, waits for the list on the web too. Tests say it as stories: as a user, as a visitor, as a developer (`chats.test.tsx`); as a user and as a server (backend `test_chats.py`, `test_chat_links.py`, `test_people_profiles.py`). Was: ring 6 only (feature `chats`); everyone else opened Will's chat under the WillpowerLab bar · BE N456 log (#1682), BE (#1684), FE (this PR)
- 2026-11-03 · N368, N365 · C1: in the iPhone app the buzz on every send (N368 item 3) is the iPhone's own light tap (`@capacitor/haptics`); the web's vibration, which an iPhone ignores, stays for the web. Was: no buzz in the app · FE (this PR)
- 2026-11-03 · N436 · C1: Forward: on the list, a swipe from the right edge (the iPhone app) or the browser's Forward (the web) opens the chat you just came back from again, after the finger; let go early and it slides back; nothing before you have left a chat. A chat being pulled in, or sliding out, no longer holds a history entry of its own. Was: no way forward; Forward on the web landed on a dead entry · BE N436 log, FE (this PR)
- 2026-11-03 · N401 · C1, §2: no demo chats for a newcomer: an empty list is Will and "Add someone to chat with", on the web as in the iPhone app (the list opens with Will alone everywhere); the list no longer asks for the two demo chats, "Sarah" and "Ariel", and the route that seeded them is gone. Was: on the web, an empty list got the two demo chats the first time · FE (this PR)
- 2026-11-03 · N372 · one voice at a time: playing a voice message pauses the one already playing, and recording a voice note pauses any that plays (`lib/willab/oneVoice.ts`, `plan/VoicePlayer.tsx`, `useVoiceNote.ts`). Was: two could play over each other, and over the mic · BE #1622, FE (this PR)
- 2026-11-03 · N441 · C1: Record an answer, the audit's fixes: the answer goes to the backend as soon as its Take is up and waits out its 5 seconds there (hidden, no push), so leaving the app no longer stops it; Undo takes it back there and Will says so in his chat ("You took this one back, so {name} didn't hear it. Here's what I noticed, for practice."); a refused send stays as "Not sent" with "Send again"; "Sent to {name}" for everyone until WhatsApp delivery exists. Was: the 5 seconds counted in the phone, a refused send vanished, Undo said nothing, "Sent to {name} on WhatsApp" for a customer · BE (N441 PR), FE (this PR)
- 2026-11-03 · N361, N363, N368 · C1, §2: the page caught up: "Record an answer" stands in the middle of the bar and "Sending to {name}… {n}" with Undo there too (N368), and §2 no longer lists Record an answer as not yet built · docs (this PR)
- 2026-11-03 · N372 · a voice note records the voice as it is: the browser's automatic gain and noise suppression are asked off, mono, on every browser and the iPhone app (`useVoiceNote.ts`, with `TAKE_MIC_AUDIO` from `src/hooks/useDualCaptureMic.ts`); echo cancelling stays on, since another voice note can be playing out loud. Nothing on screen changes. Was: `audio: true`, which turns all of them on · FE #1167
- 2026-11-03 · N369 · C1: Will's chat keeps its own bar (the "+", "Type here", the voice notebook's mic); the one bar is for chats with a person. Was (N368 items 1 and 2): Will's chat with the same bar · docs (this PR)
- 2026-11-03 · N368 · C1, §4: one bar in a person's chat: the "+" left, the mic always on the right (orange and pulsing while someone waits for your words), and the middle the one thing to do now: the three emoji, "Record an answer", or "Sending to {name}… {n}" with Undo (moved from under the answer into the bar); a short sound and a buzz where the device allows it on every send. Was (N341): the mic only while a question waited; Record an answer filled the whole bar; Sending sat under the answer. Not yet: "Ask {name} first" (it needs the consult), the specialist's "Ask about {topic}" (it needs the setup), the iPhone app's own buzz. Will's chat keeps its own bar (N369) · FE (this PR)
- 2026-11-03 · N321, N336, N342, N345, N361, N363 · C1: Record an answer: a question Will marked takes the black "Record an answer"; the recording screens on one slide, the question, no feelings check; back in the chat "Sending to {name}…" with Undo for 5 seconds, then the answer (a voice message playing the Take, up to five minutes) with "Sent to {name}" or "Sent to {name} on WhatsApp" under it. Was: the emoji and the mic only · BE #1611, #1612, FE (this PR)
- 2026-11-03 · N355 · C1: an answer as the one who asked meets it: one message, the voice, the slides in a strip under the player that marks the one being heard as it plays, and its Take's words behind "Read it"; no Take number. The backend's read carries an answer's `words` and `slides` (each slide's start). Not yet: the picks, the WhatsApp link · BE (the answer's words and slides), FE (this PR)
- 2026-11-02 · N351, N341 item 2, N337 · C1, K, §2, §4: the "+" on the left of a person's chat bar, in every chat but Will's: a tap swaps the bar for four tiles, Photos, Camera, Files and Someone else, with Cancel under them, which brings the bar back. Photos and Camera send images and Files any file, through the browser's own pickers, each its own message up to 10 MB (a photo: an image bubble that opens full size with a close ✕; a file: a bubble with its extension and its own name that downloads); Someone else opens the add sheet. The list's line is "📷" or "📄 {file name}". Each photo or file is a question for the other person (`meta.question`), and so is the sender's voice note straight after it; the mic shows while the newest message is the other person's question or your own photo or file. The prototype's own pickers and their words are not built (not signed). Was (N341): the bar was the three emoji and the mic, the mic only while the newest message was the other person's question; no "+" · BE #1606, FE (this PR)
- 2026-11-02 · N360 · C1: Will is always the first row of the list; just joined through a link, the inviter's chat is the row right under Will, still marked new with its last message or the joined line. Was (N357 item 1): the inviter's chat above Will · FE (this PR)
- 2026-11-02 · N354 · C1: in the iPhone app, no glimpse of Will's chat before the list: the rings and the chats are now read together at the chat boot, after the Lounge's own reads (they were one after the other), and the loader covers the Lounge until the list is known. Was: the Lounge for a moment, then the list over it. The website is unchanged: off, or with no chats, /chat is the Lounge at once · FE (this PR)
- 2026-11-02 · N331 · C1, K: a voice note's words, once ready, behind "Read it" under its player, inside the bubble; "Hide" closes them; closed by default for both people; none shown when there are no words; the list keeps "🎤 Voice message". The backend's read and the voice note's answer carry `words`. Was (N324): the words kept, shown nowhere · BE #1604, FE (this PR)
- 2026-11-02 · N341 · C1: in a chat with a person, the mic shows only while a question waits for your answer (the newest message is theirs and is a question: their words, or a message marked as one); answered with an emoji or a voice note, it goes. Was (N321 item 2): the mic always beside the emoji. The "+" comes with N351 · FE (this PR)
- 2026-11-03 · N366 · C1: a person's profile: from a chat's top bar (theirs) and the ☰ menu (/profile, yours): the circle, name, who they are, About, Photos and Files shared; on yours, the photo sheet, the pencil and Edit/Done. Was: the top bar opened nothing · BE (the profile routes), FE (this PR)
- 2026-11-03 · N367 item 3, N365 item 6 · C1: the add sheet as redesigned: the title large, the link with its icon, a big Copy my link that turns green "✓ Copied" and closes the sheet, the share sheet beside it in the iPhone app, three tiles and Cancel. Was: a grey box, the link, Copy my link with a tick · FE (this PR)
- 2026-11-02 · N357 · C1: after joining through a link, /chat opens on the list of chats, the inviter's chat its first row, above Will, marked new with its last message or the joined line, until it is opened. Was (N348 item 1): that chat opened · FE (this PR)
- 2026-11-02 · N354 · C1: in the iPhone app only, sign-in first, then the chats: the app opens on /login (no landing, no welcome; consent unchanged, sign-up's Terms box and Phase1AcceptanceGate); with the chats on, it opens on the list even when Will's chat is the only one, and the row under Will is then "Add someone to chat with", opening the add sheet as the + does. Was: the landing and the welcome, and no list with Will's chat alone. The website is unchanged · FE (this PR)
- 2026-11-02 · N348 · C1: joined through a link, /chat opens on the chat with the person who invited you (`/chat?with=<chat>`), not on the list; Will's first lines wait in Will's chat. Was: the list · FE (this PR)
- 2026-11-02 · N308, N310, N328, N335 · C1, §2: the join link built behind ring 6: the "+" on the list opens the add sheet with the person's own link and Copy my link; /c/<token> is the join page; joining makes one chat for the two and says whose link it was. Not yet: Invite by email, the company sign-in, the ask link · BE (this change), FE (this change)
- 2026-11-02 · N334 · C1, §4: every chat shows its own top bar, Will's included: in Will's chat the WillpowerLab bar goes and his top bar takes its place (back, his mark, "Will"), over the Lounge, which is unchanged; the WillpowerLab bar shows on the list only. Was (N322 item 4): the WillpowerLab bar, with "‹ Will" under it · FE (this PR)
- 2026-11-02 · N321 · C1, §2, §4: the mic in a person's chat: on ring 6, the bar is the three emoji in the box and the Lounge's mic on its right (40px, plain, "Voice note"); a tap records with the one recording bar (N314), up to two minutes; Stop posts the recording and its length to `POST /v2/chats/<id>/voice`, the trash throws it away, the bar comes back at once and the voice note joins the thread when the backend answers. A refused mic, a failed recording or a failed send shows nothing new. A voice note is a bubble like the others (mine orange on the right, theirs grey on the left) with the plan's small player and its time, played from `GET /v2/chats/<id>/messages/<messageId>/audio`. The emoji in the box are 38px at 23px, as the prototype's `r6Bar` draws them. Was: the three emoji only, at 40px and 21px; "the mic comes with the voice notes" · BE (the voice routes), FE (this PR)
- 2026-11-02 · N321, N322 · C1, K, §2, §4: the chats with a WhatsApp feel, on ring 6: each row a circle with the first letter of the name (no photo), the name with who they are, the time ("06:12", the date before today) and the last message on one line ("👍 It's good", "🎤 Voice message"); a new message bold with an orange dot, no number, from when the chat was last opened on this device; Will pinned first with his mark and a pin, then the chats newest first. In a person's chat the WillpowerLab bar goes and the chat's own top bar takes the top (back, the letter circle, the name and who they are); the messages start at the bottom, under "Today" or the date, each with its time; on a computer, a phone-wide column. Will's chat keeps the WillpowerLab bar. Was: rows of text only in their order from the backend, the chat under the WillpowerLab bar, the messages at the top with no time. Not yet: the mic, the voice notes and "Record an answer" · FE (this PR)
- 2026-11-02 · N298, N302, N306, N311 · C1, §2, §4: built behind ring 6 (feature `chats`): the list of chats in front of the Lounge, Will pinned first (his row opens the Lounge as it is, with a back to the list), then each chat with its title, subtitle and last message, and the two demo chats the first time; a chat's screen with back, title and subtitle, the Lounge's bubbles with no picture (N301), and the locked bar's shape with 👍 👀 🙏 in the box where Will's chat has "Type here", each sent emoji large with its meaning under it ("It's good", "Seen, I'll answer", "Thanks"). Off, /chat is the Lounge as it is. No typing, voice note or passing on yet · BE (the chats routes), FE (this PR)
- 2026-10-30 · N274 · C1: the list of chats is everyone's, not only an answerer's; a person whose only chat is Will's opens on it. Was: a speaker without customer requests never saw the list · BE #1506, FE (this PR)
- 2026-10-29 · N256 · C1 to C4, D5, F1, F2, K, §3, §5: the answerer's Lounge becomes a list of chats, Will pinned, one chat per customer; her answer, the send ask, the customer's replies and the outcomes in the customer's chat; the walk in Will's chat; no group chat. Was: every customer in one thread, a "To {customer}" chip for replies · BE #1479, FE (this PR)
- 2026-10-28 · N250 · H8, H10, H11, I4, §3: a frontier model first, the client's data as its asset, one kit per client, the enterprise pack; the call's questions 11 to 17 (what Invita already has). Was: a fine-tune at 200 pairs · BE #1466, FE (this PR)
- 2026-10-28 · §3: the questions only Invita can answer gathered for the strategic call with Invita; ours kept apart · FE (this PR)
- 2026-10-28 · N239, N240 · §3, §5: the Invita prototypes follow N239 and N240 (the spa opens its Fresha page, the Scalp Scrubber in Invita's Shopify checkout, what she sees on the picker); the open question on Invita's products online · BE #1453, FE (this PR)
- 2026-10-28 · N239, N240 · D1, E6 to E10, H, I1, K, §3: what she sees as taps on the picker; booking in the client's booking system (Fresha) and products in its shop (Shopify); the client's WhatsApp sender; the words approved; three models from one Take on one platform. Was: booking and products paid in our chat into the client's Stripe, the words waiting for the founder, the observation read from the transcript only · BE #1452, FE (this PR)

- 2026-10-28 · N236 · B6, C1, D5, D6, E2, K, §3, §5: the answerer answers in her own Lounge and is told on WhatsApp; the send ask comes once the Take is processed, before the walk; a Take 2 after sending changes nothing until she sends again; an optional first name on the form; the answerer's prototype kept. Was: the send ask after the pair, the link always opened the latest shared Take, no name on the form · BE #1448, FE (this PR)

- 2026-10-28 · N234 · E4 to E8, E10, G4, I1, §3, §5: the treatment card opens a sheet with one button, Book; the summary asks Pay; one pay sheet, Apple Pay first; the product bought the same way; the money straight to the client through Stripe Connect. Was: the booking and the cart opened the client's own pages · BE #1443, FE (this PR)
- 2026-10-28 · N231 · E3 to E8 and F1: the Lounge's own parts in the customer's chat, the treatment card with its price, the booking's summary, Skip to the product at home, the message box whenever nothing is asked. Was: one action in the dock (Book or Skip), Skip ended the chat, no way to write back · BE #1440, FE (this PR)
- 2026-10-28 · N229 · the page starts, from N223 to N228, with its prototypes kept in the backend repo as HTML and PDF; nothing built. The widget's overlay stayed on the page after "Not now" (the shadow root ignored `hidden`); fixed in the prototypes before they were kept · BE (the log, the master doc's line, the prototypes), FE (this PR)
