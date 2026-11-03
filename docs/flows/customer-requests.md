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
screen, behind ring 6 (feature `chats`, §2). Decided and drawn; §2 says the
order it is built in.

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
   chats too (backend N274); a person whose only chat is Will's opens on
   Will's chat, as the Lounge does today (Never 3). She is told of each request on WhatsApp:
   one message from WillpowerLab's number with a link to her chats (N236
   item 5).
   **As built on ring 6** (N320, N321, N322), with a WhatsApp feel, under
   the WillpowerLab bar:
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
     three dots in a grey circle), his name and a pin; then the chats,
     newest last message first. **Just joined through a link**
     (`/chat?with=<chat>`), the list opens, not a chat: the chat with the one
     who invited you is the row right under Will, marked new, its line their
     last message or, with none yet, "You joined through {name}'s link. Only
     the two of you are in this chat." (N335 item 2); opened, it takes its
     place with the rest (N357; was N348 item 1: that chat opened; was N357
     item 1: above Will).
   - **A person's chat**: the WillpowerLab bar goes; the chat's own top bar
     takes the top, full width: back, a 36px circle with the letter, the
     name and who they are. The messages start at the bottom, by the bar,
     with the day above them ("Today", otherwise the date) and the time in
     each bubble, bottom right; under a big emoji, its meaning and time
     ("It's good · 06:12"). The bubbles stay the Lounge's. One bar
     (N368, the locked prototype "One bar" v12), three places that never
     move: the "+" on the left (N351, below); the one thing to do now in
     the middle (the three emoji in the box; "Record an answer" when a
     marked question waits; "Sending to {name}… {n}" with Undo while an
     answer goes); and on the right the mic, 40px, always there, orange and
     pulsing while the newest message waits for a voice: the other person's
     question, their words (people never type, N335 item 4, so words come
     only from a customer's request) or a message the backend marks as one
     (each photo or file, and the voice note sent straight after it), or
     your own photo or file, until your voice note says what you need
     (N337). Once you answer, with an emoji or a voice note, it is plain
     again. Every send gives a short sound, and a small buzz where the
     device allows it. Was (N341): the mic only while a voice waited.
     Will's chat is the exception: it keeps its own bar, with "Type here"
     (N369).
     Will deciding what is a question (N322 item 5) is not built. The mic records with the one recording bar (the trash, the
     strip with Stop inside, N314), up to two minutes; Stop sends, the
     trash throws it away, and the bar comes back. The voice note joins
     the thread once the backend has kept it; a refused mic, a failed
     recording or a failed send (any refusal, the processing authorization's
     too) brings the bar back and shows nothing new. A voice note is a
     bubble like the others, mine orange on the right, theirs grey on the
     left: the plan's small player (play, the drawn bars, the length) and
     the time bottom right. Under the player, once its words are ready,
     "Read it" opens them inside the bubble and "Hide" closes them; closed
     by default, for both people, so the voice is heard; a voice note with
     no words shows none, and the list keeps "🎤 Voice message" (N331).
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
   - **The "+"** (N351, N335 item 3, N337; built 2026-11-02 behind the
     same ring), in every chat but Will's (Will's chat keeps the Lounge's
     bar): a tap swaps the bar for a row of four round coloured tiles, each
     with its name under it, Photos, Camera, Files and Someone else, and
     "Cancel" under the row, quiet, which brings the bar back (the
     prototype's `attachSheet`). Photos opens the browser's own picker for
     images, several at once; Camera the same, to the camera on a phone (on
     a computer, the browser's file picker); Files the picker for any file.
     We draw no picker of our own. Each one picked is sent on its own, up
     to 10 MB (a photo over 4 MB is redrawn smaller in the browser first:
     the platform refuses a body over about 4.5 MB), and joins the thread
     once the backend has kept it. A photo is a bubble with the image, mine
     orange on the right, theirs grey on the left, its time under it;
     tapped, it opens full size, with a close ✕ and no words. A file is a
     bubble with a small red tile holding its extension, from its own name
     ("PDF"), and its name; no size, no other words; tapped, it downloads
     through the backend. Each photo or file opens a new question for the
     other person, for that person only (N341 item 2): the mic rule above.
     Someone else opens the add sheet the list's "+" opens (the join link,
     below). The list's line is "📷" after a photo and "📄 {file name}"
     after a file. A refused picker, a failed send or a file too big brings
     the bar back and shows nothing new. Not built: the prototype's own
     pickers and their words ("Photos and screenshots", "For {name} only.",
     "Send {n}", "Back"), not signed (N351 item 2).
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
   - **Will's chat** has its own top bar too, as every chat (N334 item
     1): back, his mark and "Will", over the Lounge; the WillpowerLab bar
     shows on the list only. Was (N322 item 4): the WillpowerLab bar with
     "‹ Will" under it. On a computer, the list and a person's chat sit in
     a phone-wide column in the middle.
   - **Back** (the iPhone's swipe, the browser's Back) from Will's chat or
     a person's chat goes back by one, to the list, however abrupt the
     swipe; from the list it goes nowhere, never off /chat to the sign-in
     page (N372).
   - **Record an answer** (N321 item 4, N336, N342, N345, N361, N363):
     when the question waiting for your answer is one Will marked as about
     a product or a treatment (`meta.record_answer`), the middle of the bar
     is the black button with the red dot, "Record an answer" (N368). It
     makes the question a
     project of its own, one slide holding the asker's words, and opens
     the recording screens on it at once, the person named above "Take 1 ·
     Slide 1 of 1", no feelings check
     ([recording-screens.md](recording-screens.md) step 6). Finish take
     brings you back to the chat: in the middle of the bar, "Sending to
     {name}… {n}" counting down 5 seconds with "Undo" (N368), then the
     answer goes (`POST /v2/chats/<id>/answer`, a voice
     message that plays the Take itself; up to five minutes). Under it,
     "Sent to {name} on WhatsApp" for a customer, "Sent to {name}" for a
     colleague, with a check. The person gets just the answer, never its
     Take. Undo, a Take that does not upload, or a refused send shows
     nothing new. Not yet: "Practise with Will" (N344), "Consult with
     someone first" (N343).
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
     that stops working on the way, lands on /chat. Both people need the
     ring for now. Not yet: "Invite by email" (N307), "Join with your
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
- The chats between people, as built on ring 6 (N320 item 4, N322):
  "You", "Customer · Invita", "Your colleague · Invita", Sarah's and
  Ariel's lines, "Will", "Only 👍, 👀 or 🙏 for now.", "Today", "🎤 Voice
  message", the dates and the clock times.
- Under a voice note's player (N331): "Read it", "Hide".
- The "+" in a chat with a person (N337, N351): "Photos", "Camera",
  "Files", "Someone else", "Cancel", and "Add to your chat with {name}" as
  its name for a screen reader. The list's "📷" and "📄 {file name}" are an
  emoji and the person's own file name.

---

## 2. In flight

Built behind ring 6 (feature `chats`, the founder only; 2026-11-02): the
list of chats in front of the Lounge (C1: Will pinned, then each chat's
letter circle, title, subtitle, time and last message, newest first, a new
message bold with an orange dot; the first time, the two demo chats) and a
chat's screen, the conversation only, under its own top bar in the
WillpowerLab bar's place, with the day and each message's time, the
three emoji in the locked bar and the mic beside them for a voice note of
up to two minutes, played in its bubble (N298, N302, N305, N306, N311,
N321, N322). Off, /chat is the Lounge as it is. Not yet: passing on, the
status and the filters. Built since: the join link, the add sheet and the join page
(C1, N308, N328, N335); the "+" in a chat with a person, with Photos,
Camera, Files and Someone else (C1, N351); "Record an answer", a marked
question answered with a Take that goes back to the chat (C1, N361,
N363).
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
the day, `chatOpened.ts` what is new; the voice note records with
`useVoiceNote.ts` and the locked `RecordingBar.tsx`, and plays with
`plan/VoicePlayer.tsx`), `src/services/api/chats.ts` and the BFF routes
`src/app/api/v2/chats/` (the voice note's upload `[chatId]/voice/` and its
playback `[chatId]/messages/[messageId]/audio/`, in byte ranges); the
backend's `/v2/chats` routes, `POST /v2/chats/<id>/voice` and
`GET /v2/chats/<id>/messages/<messageId>/audio`. The "+" (N351): its
tiles, the photo and file bubbles and the mic rule (`micShows`) in
`ChatThread.tsx`, a big photo made smaller in `photoForUpload.ts`, the add
sheet reused from `ChatList.tsx`; the BFF routes `[chatId]/photo/` and
`[chatId]/file/` (both through `chatUpload.ts`) and
`[chatId]/messages/[messageId]/file/`; the backend's
`POST /v2/chats/<id>/photo`, `POST /v2/chats/<id>/file` and
`GET /v2/chats/<id>/messages/<messageId>/file` (table `chat_message_files`).

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

- 2026-11-03 · N372 · one voice at a time: playing a voice message pauses the one already playing, and recording a voice note pauses any that plays (`lib/willab/oneVoice.ts`, `plan/VoicePlayer.tsx`, `useVoiceNote.ts`). Was: two could play over each other, and over the mic · BE #1622, FE (this PR)
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
