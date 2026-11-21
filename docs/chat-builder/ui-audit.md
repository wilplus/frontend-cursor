# UI, before and after

> **Label: Reference.** The chats' header (`TopBar` in `src/components/willab/chats/TopBar.tsx`) and the locked bar (`ChatBar.tsx`) are the source. Widths follow the thread's `px-4`.

## Header

Before: `BackRow` inside `ONE_BAR_ROW` (`h-[60px] px-2.5`), a 20px arrow, the name at 13.5px, no circle, no subtitle.

After: `TopBar`, drawn by the shared `PageHeader` (founder visual feedback, 2026-11-17; the divider correction, 2026-11-18). The row is `h-[60px]`, `px-[15px]`, on the content rail. Back is `h-11 w-11` with a `h-6 w-6` chevron. The circle is 36px. The name is `text-[16px] font-semibold`. The subtitle is `text-[12.5px] text-muted-foreground` ("You run this chat."). Share, and Live / Build when there is something to try, stay in the right slot. The separator is the header's own line, viewport-wide, on the header's bottom edge. An earlier note on this page said `pl-1 pr-4`, and the branch had used a fixed line at `safe-area + 60px`. The shared header replaces both.

## The page

Your chat stays `px-4 py-4`, the same inset as a chat thread. Search is `h-11 rounded-xl border-border text-[16px]`, focus `border-primary`. Sections are `rounded-2xl border-border`. A row is `min-h-12 px-3.5`, the label `text-[15px]`.

## A row's bar

Before: `h-12 px-2`.

After: the shared `ChatBarRow` (`min-h-[60px]`, 8px around the controls, and the phone's home-bar inset when that is larger). Back, the place in the list, and Next sit in the header's right slot. The bottom of a visitor chat, the talk, and a setup step is that same row (the + on the left when the chat takes it, one thing in the middle). A button footer that is not the composer uses `bar-space`. `docs/flows/feedback-walk-and-chat.md` J9 names `bar-space` for every bottom bar; the chat thread's own row is this shared row, which keeps J9's 8px and adds the home-bar inset.

## AI models

Before: `gap-2`, and the coming rows at `text-[15.5px]` with no minimum height.

After: `gap-3 px-4 py-4`, the same inset and gap as Your chat. Coming rows are `min-h-12 text-[15px]`, the table row's type and height. Borders stay `border-border`, radius `rounded-2xl`.

## Left alone

Scrollbars on these pages were already `no-scrollbar`. The locked walk, Ideal Text, and recording screens were not restyled.
