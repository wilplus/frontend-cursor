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

**Not built.** Decided and drawn; nothing in the code yet. §2 says the order
it is built in.

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

1. The request is the Take's one ask, in the Lounge's footer slot that every
   ask uses: Will's lead-in bubble in the thread, the grey card with the
   customer's words and photo, Not now | Answer (walk page E1, D4). The
   lead-in names the customer by the first name they gave, or "A customer"
   (N236 item 4). The answerer answers in her own Lounge, as any speaker
   (N236 item 1), and is told of each request on WhatsApp: one message from
   WillpowerLab's number with a link to her Lounge (N236 item 5).
2. Nothing sits between a Take and its Ideal Text: a request waits until the
   chain of the last Take is done. Not now brings it back after the next Take
   (Never 3).
3. One project per request, named by the customer's ask (N223 item 3).
4. A request unanswered for 24 hours sends one email to the founder and one
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
5. **Send first, the walk after** (N236 item 2): once the Take is
   processed, its Ideal Text card lands in the thread marked new, and Will
   asks at once "Send this answer to {customer} on WhatsApp?", Not yet |
   Send, with a grey card listing what the customer gets (her voice, the
   text, each pick with its price). A line in the thread when it went. The
   walk waits on the card and opens from it, as after any Take.
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
   message, lands in the answerer's chat like the request, as an ask with the
   customer's words. The answer comes back in the same thread, later; no
   instant answer until a model answers alone (N225 item 5, N231 item 5).
2. A follow-up may be typed in the card, no Take, sent the same way; the pair
   is still recorded. Record instead makes it Take 2 of the same project. The
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
8. **Retrieval**: embeddings per workspace in Supabase with pgvector, through
   the authorization path (N224 item 4).
9. **Autonomy**: the founder opens the door per workspace after the
   evaluation; the client turns it on per request type; a health red flag
   always goes to a person (N224 item 3).
10. **The client's IP**: the export, JSONL of the pairs with the labels, the
    schema and the outcome, the documents and the golden set (N223 item 5).

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

---

## 2. In flight

Nothing built. The order of the build, each slice proving one thing (N223
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
  card, before the walk (walk page D4, N236 item 2); a reply to the customer
  from the message box, with a "To {customer}" chip over it (walk page E1).
- **Where the prototypes are older than a decision**: the customer's
  prototype still books and pays in our chat (N234), where Book now opens
  Fresha and Buy opens Shopify's checkout (N239); the answerer's picker has
  no "what she sees" taps yet (N240 item 2). The Mila prototype's answer
  page is a page with cards, not the chat (N228).
- **The colours**: the widget is white and grey (the founder, 28 October); the
  answer chat is in the client's colours (the founder, the same day). Both as
  drawn, until the founder says otherwise.
- **Fresha and Shopify**: whether Fresha gives the booking back to us as the
  outcome, and how; Shopify's cart link and its order coming back (N239).
- **Before the answerer's side is built** (N236 item 6): how fast she must
  answer and what follows when she does not; many requests at once (one ask
  at a time, or a list); the photos (how many, kept how long, who at the
  client sees them); who keeps the catalogue and its prices; the price by
  spa on the slide; whether an answer uses her tokens; fixing a word before
  sending; Meta's template approval for Invita's sender and the US SMS
  fallback; one inbox for several answerers; the answerer's account, photo
  and name.
- **Before any photo trains a model** (N240 item 5): the customer's yes to
  training and its retention, counsel on the US medical-device question, the
  second trichologist who labels blind, and the vision training provider.

## 4. Where it lives

Not built. Where it will live, so §1 has a home from the first PR:

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

- **The answerer's side, in her Lounge** (2026-10-28, N236; the newest for
  the answerer): Ariel at Invita, from the WhatsApp message to the request
  as her ask, the photo, the picker of Invita's treatments, the recording
  over the request and her picks, processing, the send ask before the walk,
  the walk, the Ideal Text, the customer's reply and her typed answer, the
  booking's outcome, and the questions still open (19 pages). PDF
  [`6-answerer-side-in-her-lounge.pdf`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/6-answerer-side-in-her-lounge.pdf) ·
  HTML [`ariel/ariel-lounge.html`](https://github.com/wilplus/backend-cursor/blob/main/docs/design/customer-requests-2026-10-28/ariel/ariel-lounge.html) · link
  <https://claude.ai/artifact/CeeWQpvUrZT31aj8Lm3Fsa>.
- **The customer's side, on a phone** (2026-10-28, N227, N228, N231, N234,
  N236; the newest for the customer): invitaheadspa.com with the widget, the popup, the form, the text
  message, the answer as a chat, the treatment card and its sheet, the
  booking with its summary, paying in the chat, Skip and buying the product
  at home, the message box (17 pages). PDF
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

- 2026-10-28 · N239, N240 · D1, E6 to E10, H, I1, K, §3: what she sees as taps on the picker; booking in the client's booking system (Fresha) and products in its shop (Shopify); the client's WhatsApp sender; the words approved; three models from one Take on one platform. Was: booking and products paid in our chat into the client's Stripe, the words waiting for the founder, the observation read from the transcript only · BE #1452, FE (this PR)

- 2026-10-28 · N236 · B6, C1, D5, D6, E2, K, §3, §5: the answerer answers in her own Lounge and is told on WhatsApp; the send ask comes once the Take is processed, before the walk; a Take 2 after sending changes nothing until she sends again; an optional first name on the form; the answerer's prototype kept. Was: the send ask after the pair, the link always opened the latest shared Take, no name on the form · BE #1448, FE (this PR)

- 2026-10-28 · N234 · E4 to E8, E10, G4, I1, §3, §5: the treatment card opens a sheet with one button, Book; the summary asks Pay; one pay sheet, Apple Pay first; the product bought the same way; the money straight to the client through Stripe Connect. Was: the booking and the cart opened the client's own pages · BE #1443, FE (this PR)
- 2026-10-28 · N231 · E3 to E8 and F1: the Lounge's own parts in the customer's chat, the treatment card with its price, the booking's summary, Skip to the product at home, the message box whenever nothing is asked. Was: one action in the dock (Book or Skip), Skip ended the chat, no way to write back · BE #1440, FE (this PR)
- 2026-10-28 · N229 · the page starts, from N223 to N228, with its prototypes kept in the backend repo as HTML and PDF; nothing built. The widget's overlay stayed on the page after "Not now" (the shadow root ignored `hidden`); fixed in the prototypes before they were kept · BE (the log, the master doc's line, the prototypes), FE (this PR)
