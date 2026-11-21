# Usability, for a 12-year-old

> **Label: Reference.** Build, then the chat it produces. Tap and go. Two choices.

## First pass

| Issue | Why it confuses | Change |
| --- | --- | --- |
| Clear sat in a short, grey control inside the search | A small target, and grey looks switched off | The control is the full height of the field, 44px, in the same dark text as a button |
| Build's header was a small arrow and a 13.5px name, with no picture and no "You run this chat." | It did not look like the chat they just left, so Back felt like a different app | The header is the chats' header: arrow, circle, name, "You run this chat." |
| A row's own bar was shorter and tighter than the header | Next and Back did not line up with the page | That bar is 60px tall with the same side inset as the chat, 16px |
| The first-run wizard still says tick all that apply | More than two choices, and it is not the page a host opens from the table | Left as it is. The table's edits stay two choices. Noted, not rebuilt tonight |
| In a setup row, Send a photo and Send a file only close the sheet | A tap that does nothing looks broken | Left as it is. Those sends belong to the visitor's chat, where a file or a photo can be posted. Noted |

## The whole flow, in order

1. Search Clear was a short grey control. A 12-year-old misses it. Now it is the full height of the field. Applied.
2. The Build header did not look like the chat they left. Now it is that header. Applied.
3. A row's bar was a different height. Now it matches. Applied.
4. AI models rows used a slightly different type size (15.5px) and a tighter gap. Now 15px and the same gap as Your chat. Applied.
5. They send and the walk's contents asked a person to tick every row, then Done. That is more than two choices. Now each kind is its own step: "Can they send a recording?" Yes or No. The walk asks "After they send a recording, should your chat show them their best moment and why it worked?" and then one plain question for the other way and the helper words. The saved list is the one that was ticked, and it is never empty. Applied on the first run and in the row chats.
6. In a setup row, Send a photo and Send a file closed the sheet and saved nothing. They are not in that sheet. People send a photo or a file from their own chat. Applied.

## Second pass

Items 1 to 6 are in the build. A send step is one question and two taps. The + sheet in a setup row has no Send a photo and no Send a file. Search, Keep, Next, and the header back still behave as before. Nothing new appeared on the second pass.

## Scoring rubric

Each row is 10 points. The score is the points earned divided by 190. A row earns 10 only when the named test passed. The numbers below are from the run on 17 Nov 2026.

| # | Criterion | Points | Evidence |
| --- | --- | --- | --- |
| 1 | Success rate | 10 | `scripts/talk-e2e.mjs`: tap, type and voice each finished the Speaking Coach and the shop. 6/6. |
| 2 | Taps against the minimum | 10 | `talkAudit.test.tsx` "fifteen taps build the Speaking Coach" asserts 15, one per answer plus Send on the quote. |
| 3 | Reading level at most grade 6 | 10 | The e2e measured the screen at grade 3.6. |
| 4 | Binary choices only | 10 | The brief shows two quotes, Speaking coach and You decide. Later questions are Yes and No. |
| 5 | Voice, tap and text do the same thing | 10 | The e2e snap matched for tap, type and voice on both scripts. |
| 6 | Recovery and undo | 10 | The e2e undoes the first answer in all three modes and lands on "What do you do?" |
| 7 | Same language as the deck | 10 | Orange quotes, a 28px composer, a 44px mic. The e2e found no control under 44px. |
| 8 | Visible progress | 10 | The stepper is on screen. "Say go?" shows before the preview. |
| 9 | No hidden state | 10 | `data-talk-snap` is what both tests read. |
| 10 | No scrollbars or overflow | 10 | The e2e found no visible scrollbar at 390×844. |
| 11 | You decide answers one question | 10 | The brief offers You decide. It sets what the chat does, then asks the next question. The plan does not offer it. |
| 12 | Plan before build, then say go | 10 | "not saved as the live coach yet" passed, then Say go opens the preview. |
| 13 | One question at a time | 10 | There is no Just build it. Saying done does not skip the open question. The phone run answers each question, then Say go. |
| 14 | A live preview with Keep and Next | 10 | `data-preview-keep` and `data-preview-next` are on the preview. |
| 15 | Targeted edits | 10 | Changing the price and the greeting left They send as it was. |
| 16 | Write this for me, then keep or rewrite | 10 | The button fills the field. Rewrite clears it. Keep stores it. |
| 17 | Capability chips | 10 | Record, Type, Photo, File and Train. Tapping Photo adds a photo and leaves the name. |
| 18 | A first-line greeting | 10 | The preview's first line is the greeting. |
| 19 | Auto-save, and Publish to go live | 10 | A draft is stored after the first answer. Publish sets the flag and the test saw no fetch. |
| 20 | Start your own chat is a row at the bottom | 10 | `ownChatHome.test.tsx`: the row is last, and it sits above Start a new project. |
| 21 | The sheet is one or two sentences, then Yes and Close | 10 | Close leaves the row where it was. Yes is the only way on. |
| 22 | Yes opens Build and pins the chat at the top | 10 | The row's name is the chat's name. Back returns to the list. |
| 23 | Share copies the link | 10 | The button copies `/c/…` and says Link copied. The phone run does the same at 390×844. |
| 24 | An icon, with the three-dots badge | 10 | The circle starts as the initial. Tapping it in the top bar opens the picker. An emoji replaces it. The badge is about 40% of the circle. |
| 25 | Settings lists each answer | 10 | The Settings tile opens the list. Each question is one line and the answer is under it. A tap opens that question. Search stays on that list. |
| 26 | Your own code is one tap | 10 | The row opens on its own. After Yes, the host describes what it should do or pastes code. A description becomes one line, with Keep and Change. |
| 27 | Test the chat as a visitor | 10 | The Test tile opens the chat as a visitor. A send gets the chat's own reply. Back returns to the four tiles. |

**270 / 270 = 100%.** That is above 95%. The home is four equal tiles: 1 Build, 2 Settings, 3 Test, 4 AI. A new chat highlights only Build. A tick marks a finished step. A settings row replaces the chat bar, so the screen has one top bar. `node scripts/own-chat-e2e.mjs` printed `OWN CHAT 76/76` at 390×844 and at 1024×768.

The 30/30 run only opened the talk (`/dev/talk`). It never opened a row of Your chat, so a Yes on the last They send question could do nothing and the score still passed. Row chats are part of the audit now: `needsYou.test.tsx` "Yes and No on a row's last step show the answer, save, and open the next row", and `node scripts/row-yes-e2e.mjs`.
