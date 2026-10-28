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
   optional, the mobile number, one consent tick. Send is live once there is
   a photo or words, a number and the tick. Then "Sent" and Done. Nothing
   stays on the client's site (N225 item 4).
7. Sending creates the customer's guest identity and one request row in the
   workspace, and the request lands in the answerer's chat.

### C · The request in the answerer's chat

1. The request is the Take's one ask, in the Lounge's footer slot that every
   ask uses: Will's lead-in bubble in the thread, the grey card with the
   customer's words and photo, Not now | Answer (walk page E1, D4).
2. Nothing sits between a Take and its Ideal Text: a request waits until the
   chain of the last Take is done. Not now brings it back after the next Take
   (Never 3).
3. One project per request, named by the customer's ask (N223 item 3).
4. A request unanswered for 24 hours sends one email to the founder and one
   to the client, the same pattern as `coach_moments_queue.reach_alarm`
   (N223 item 10).

### D · The answer is a Take

1. **What she recommends first.** Answer opens a tap list in the lens, the
   same kind as the helper words: the client's catalogue. Each pick is a
   slide (N226 item 1).
2. **The slides**: the customer's request and photo first, then each pick, in
   the order picked. "Just the request" records over the request alone.
3. **Her voice over the slides, camera off.** The locked recording screen as
   it is: the top line, the slides, the strip, Back, Next slide, Finish take.
   No video is sent or stored unless she adds one, as a coach may (N226).
4. The Take goes through the processing-authorization path and the pipeline
   like every Take: the transcript, the walk on how she said it, the Ideal
   Text one paragraph per slide (Never 5 holds: Take 2 replaces the text, the
   old one stays in the history).
5. After the pair, the Take's one ask: "Send this answer to {customer}?",
   Not yet | Send. A line in the thread when it went. The closing message
   with Record Take N comes last, as after every Take.

### E · Where the customer meets the answer

1. Four ways, from the most to the least: the client's own app; **the web
   app** on the client's subdomain of willpowerlab.com; WhatsApp as the
   conversation; SMS. **Built now: the web app, with WhatsApp carrying the
   link and verifying the number** (N228).
2. The link comes by WhatsApp where that is the norm, by SMS where it is not:
   the number's country code decides; one line on the form switches; a failed
   WhatsApp delivery falls back to SMS, never both. The link always opens the
   latest shared Take.
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
   and one button, Book · from {price} (N231 item 2, N232 item 1).
5. **One ask at a time, in the footer**, as the Lounge's: the answerer's
   question in the thread and its two equal buttons under it, Skip | Book. A
   field sits in a grey footer card (the ZIP), a pick is tall options (the
   spa, the day). A product recommendation asks Not now | Buy · {price} (N232 item 3); an
   answer that recommends nothing asks nothing (N225 item 2, N231 item 1).
6. **Booking, one question at a time, in the thread**: where (a ZIP or
   postcode, or "Use my location"), asked only now and once; the client's
   salons nearest first, with the days the answerer is there and each spa's
   price; the day; then a summary (the treatment, the day and time, the spa,
   its price) with Change | Pay {price}. Each answer lands as the customer's
   bubble (N227, N231 item 3).
7. **Paid in the chat** (N232): Pay opens one sheet over the chat: the line,
   the total, Apple Pay first, Pay with card under it, and one line on who is
   paid. Then the customer's bubble says Paid {price}, and the answerer's
   says Booked and paid, with the address, directions, the receipt and Add to
   calendar.
8. **Skip is not the end**: the answerer offers what she uses in the
   treatment for home, as a card, with Not now | Buy · {price}; Buy opens the
   same pay sheet with where to send it; then Paid, on its way, with the
   receipt (N231 item 4, N232 item 3).
9. **The message box whenever nothing is asked**: +, Type here, the mic, as
   in the Lounge. The customer can always write, add a photo or record a voice
   message to the answerer (N231 item 1).
10. **The money goes straight to the client**: each client connects its own
    Stripe account once in admin (Stripe Connect); WillpowerLab never holds
    it, and the receipt is the client's. A payment through the chat is the
    request's outcome (N232 item 4).
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
   Stripe only, never WillpowerLab or the client's page (N232 item 4).

### H · What the client's model learns

1. **The pair**: the request, the answer schema, the final answer and its
   transcript, and the **outcome**: bought, booked, or not yet (N224, N225
   item 3).
2. **The answer schema**: what was observed, which products, the routine,
   when to come in, which signs mean a doctor. Filled by the answerer's picks
   before she speaks; the AI reads the rest from the transcript; the founder
   reads and corrects it in admin (N224 item 1, N226 item 2).
3. **No AI visible in the first version.** When drafts come (from about a
   hundred pairs), Never 2 holds for the answerer: she records first and sees
   the draft after (N224 item 2).
4. **Retrieval**: embeddings per workspace in Supabase with pgvector, through
   the authorization path (N224 item 4).
5. **Fine-tune**: a surface per workspace in the existing pipeline, at 200
   pairs, its golden set scored on the schema, never on token overlap alone
   (N224 item 3).
6. **Autonomy**: the founder opens the door per workspace after the
   evaluation; the client turns it on per request type; a health red flag
   always goes to a person (N224 item 3).
7. **The client's IP**: the export, JSONL of the pairs with the schema and the
   outcome, the documents and the golden set (N223 item 5).

### I · Admin

1. The founder creates a workspace: the name and colour the customer sees,
   the answerer, the WhatsApp sender, the salons with the answerer's days and
   prices, the script tag to send to the client (N223 item 13). The client
   connects its Stripe account there once, and gives its cancellation policy,
   shipping and product prices (N232 items 4 and 5).
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

All new, all waiting for the founder's OK (Never 4). As the prototypes draw
them:

- The pill: "Ask our trichologist".
- The popup: "Not sure which treatment?", "Send a photo of your scalp. Our
  trichologist answers you within a day.", "Ask", "Not now".
- The form: "Ask our trichologist", "Add a photo", "Your scalp or hair. Only
  our trichologist sees it.", "A few words, optional", "Mobile number, for the
  answer", the consent sentence (counsel writes the live one), "Send",
  "Sent", "Our trichologist answers you by text within a day.", "Done".
- The answerer's chat: "{customer}, a customer of {client}, asks for your
  advice.", "Asked {time} · will get the answer on WhatsApp", "Answer", "What
  do you recommend to {customer}? Tap it.", "Each pick is a slide. You record
  over them, camera off.", "Record over {n} slides", "Just the request", "Send
  this answer to {customer}?", "Not yet", "Send to {customer}", "Sent to
  {customer} on WhatsApp · {time}", "{customer} replied to your answer.",
  "Record instead".
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

- **The words in §1 K**, all of them.
- **The DPA and the form's consent**, for counsel, before the first client.
- **The locked screens it touches**, each needing its own page's line when
  built: the request as an ask in the Lounge (walk page E1); the picker in the
  lens (walk page); the slides from the picks on the recording screen
  (recording screens' page); the send ask after the pair (walk page D4).
- **Where the prototypes are older than a decision**: the Mila prototype's
  answer page is a page with cards, not the chat (N228, drawn on the Invita
  prototype); its form asks for a WhatsApp number where Invita's asks for a
  mobile number by text (E2 decides by country code).
- **The colours**: the widget is white and grey (the founder, 28 October); the
  answer chat is in the client's colours (the founder, the same day). Both as
  drawn, until the founder says otherwise.
- **How a paid booking reaches each client's calendar** (the client's own
  booking system, or a calendar we keep): open (N232 item 4).
- **The cancellation policy, shipping and the product's price** are the
  client's; each tester gives them (N232 item 5).

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

- **The customer's side, on a phone** (2026-10-28, N227, N228, N231, N232; the
  newest): invitaheadspa.com with the widget, the popup, the form, the text
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
- **The answerer's side and admin** (2026-10-27, N223 to N227; its customer
  pages are older than N228): the request in the Lounge, the picker, the
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

- 2026-10-28 · N232 · E4 to E8, E10, G4, I1, §3, §5: the treatment card opens a sheet with one button, Book; the summary asks Pay; one pay sheet, Apple Pay first; the product bought the same way; the money straight to the client through Stripe Connect. Was: the booking and the cart opened the client's own pages · BE #1443, FE (this PR)
- 2026-10-28 · N231 · E3 to E8 and F1: the Lounge's own parts in the customer's chat, the treatment card with its price, the booking's summary, Skip to the product at home, the message box whenever nothing is asked. Was: one action in the dock (Book or Skip), Skip ended the chat, no way to write back · BE #1440, FE (this PR)
- 2026-10-28 · N229 · the page starts, from N223 to N228, with its prototypes kept in the backend repo as HTML and PDF; nothing built. The widget's overlay stayed on the page after "Not now" (the shadow root ignored `hidden`); fixed in the prototypes before they were kept · BE (the log, the master doc's line, the prototypes), FE (this PR)
