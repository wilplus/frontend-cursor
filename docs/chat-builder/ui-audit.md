# UI, before and after

> **Label: Reference.** The chats' header (`TopBar` in `src/components/willab/chats/TopBar.tsx`) and the locked bar (`ChatBar.tsx`) are the source. Widths follow the thread's `px-4`.

## Header

Before: `BackRow` inside `ONE_BAR_ROW` (`h-[60px] px-2.5`), a 20px arrow, the name at 13.5px, no circle, no subtitle.

After: `TopBar`. Classes: `h-[60px] pl-1 pr-4`, back button `h-11 w-11`, chevron `h-6 w-6`, circle 36px, name `text-[16px] font-semibold`, subtitle `text-[12.5px] text-muted-foreground` ("You run this chat."). The Live / Build switch stays on the right when there is something to try.

## The page

Your chat stays `px-4 py-4`, the same inset as a chat thread. Search is `h-11 rounded-xl border-border text-[16px]`, focus `border-primary`. Sections are `rounded-2xl border-border`. A row is `min-h-12 px-3.5`, the label `text-[15px]`.

## A row's bar

Before: `h-12 px-2`.

After: `h-[60px] px-4`, the header's height and the thread's inset. Back, the place in the list, and Next sit in that row. The bottom of a visitor chat is still `ChatBar` (`p-2`, the + on the left, one thing in the middle).

## Left alone

Scrollbars on these pages were already `no-scrollbar`. The locked walk, Ideal Text, and recording screens were not restyled.
