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
5. The first-run wizard still says tick all that apply. The table a host opens does not. Left. Rebuilding the first run would change a path this pass did not open from the table.
6. In a setup row, Send a photo and Send a file only close the sheet. Left. Those sends post from the visitor's chat, where a file can be attached.

## Second pass

Items 1 to 4 are in the build. Search, the table, Keep, Next, and the header back were clicked in the unit tests after the change. Items 5 and 6 stay written here so they are not forgotten. Nothing new appeared on the second pass.
