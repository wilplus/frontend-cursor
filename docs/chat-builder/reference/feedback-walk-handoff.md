# Feedback Walk handoff

## Source of truth

Use the current prototype as the visual and interaction reference:

- Prototype: `http://127.0.0.1:8765/chat-continue-prototype.html`
- Single-chunk state: `http://127.0.0.1:8765/chat-continue-prototype.html?project=project-1`
- Multiple-chunk state: `http://127.0.0.1:8765/chat-continue-prototype.html?project=project-2`
- Prototype file: `/Users/arturwillonski/.codex/visualizations/2026/11/13/01a1d59c-9be3-7640-b932-b4cbf92ab66e/chat-continue-prototype.html`

Build this as a direct translation of the prototype. Do not introduce a different card metaphor, extra progress indicators, or additional explanatory copy.

## Product meaning

The Feedback Walk is a project-level practice history made of slide-range chunks.

Each chunk is independent:

- Attempts belong to that chunk only.
- Delivery quality belongs to that chunk only.
- The slide range belongs to that chunk only.

The top-level `Progress` value is the only project-level readiness signal. It summarizes the presentation as a whole. Do not repeat the percentage or a progress bar inside a chunk.

Example:

```text
Slides 1-5    10 attempts    Not yet there
Slides 6-12   12 attempts    Good
Slides 25-30  1 attempt      Almost
```

Supported delivery labels, from weaker to stronger:

1. `Not yet there`
2. `Almost`
3. `Good`
4. `Strong delivery`

## Card hierarchy

The final hierarchy is:

```text
Presentation name                         editable

Progress                                  74%
[ orange overall progress bar ]

[ blurred slide image ]  Slides 25-30     1 attempt
                          Good / Strong delivery

Feedback                    Ideal text
```

For a presentation with more than one chunk, show the latest chunk by default. Add a quiet control above it:

```text
Show 4 earlier chunks
```

When expanded, show all chunks in chronological order and change the control to:

```text
Hide earlier chunks
```

For a presentation with only one chunk, omit the earlier-chunks control entirely.

## Visual specification

Use the existing app language from the prototype:

- White page and chat surface.
- Light neutral card background: approximately `#f5f5f5`.
- Text: approximately `#121212`.
- Secondary text: approximately `#737373`.
- Borders: approximately `#ebebeb`.
- Accent orange: approximately `#ff6a14`.
- Card radius: approximately `20px`.
- Chunk radius: approximately `13px`.
- Compact, quiet typography; do not use decorative symbols or emoji.

The current chunk is a white inset card. The latest chunk has a thin orange emphasis border or outline. Older chunks are visually quieter but remain readable.

### Thumbnail

Keep a clickable slide thumbnail on every chunk. It should look like a small first-slide preview, but it may be blurred or abstracted so the text is not readable:

- Blue presentation-like image treatment.
- Soft blurred geometric color blocks or a blended slide image.
- No text is required inside the thumbnail.
- The thumbnail is a button and opens the same destination as `Ideal text`.

Target size:

- Single-chunk card: about `68 x 50px`.
- Compact multi-chunk row: about `57 x 42px`.

### Chunk content

Left side:

- Editable range, for example `Slides 25-30`.
- A subtle `Edit` affordance appears on hover or focus.
- Delivery label directly below the range with a small colored dot.

Right side:

- Orange pill: `1 attempt`, `12 attempts`, etc.
- Use singular `attempt` for one and plural `attempts` otherwise.

Do not show a chunk percentage, chunk progress bar, or a take number.

### Actions

Use two minimal buttons at the bottom:

- `Feedback` opens the feedback experience.
- `Ideal text` opens the ideal text view. It must not be labelled `Present` unless it actually opens a presentation.

Buttons should remain visually compact while retaining a touch target of at least `40px` high.

## Interaction requirements

1. Clicking the presentation name enters inline editing.
2. Clicking or focusing the slide range reveals the edit affordance and allows inline editing.
3. Pressing Enter commits an edit; pressing Escape restores the previous value.
4. Clicking the thumbnail opens the related presentation or Ideal text destination.
5. Clicking `Feedback` opens feedback for the selected/latest chunk.
6. Clicking `Ideal text` opens the ideal text for the selected/latest chunk.
7. Clicking `Show earlier chunks` expands the complete history.
8. Clicking `Hide earlier chunks` returns to the latest-chunk view.
9. The single-chunk state must not reserve space for the hidden-history control.

## Required demo states

### Testingg: one chunk

```text
testingg
Progress                                      10%
Slides 1-5                         10 attempts
                                  Not yet there
Feedback                         Ideal text
```

### Board meeting: five chunks

Use this sample data to demonstrate that attempts and delivery are per chunk:

```text
Presentation: Board meeting
Progress: 74%

Slides 1-5     10 attempts     Not yet there
Slides 6-12    12 attempts     Good
Slides 13-18   6 attempts      Almost
Slides 19-24   8 attempts      Good
Slides 25-30   1 attempt       Strong delivery
```

The multi-chunk card initially shows only `Slides 25-30` and `Show 4 earlier chunks`.

## Acceptance checklist

- `Progress` is the only project-level progress label.
- The orange progress bar appears only below the top Progress row.
- Every chunk has its own slide range, attempts count, and delivery label.
- The delivery label is directly under the slide range.
- The thumbnail is visible, blurred/abstract, text-free, and clickable.
- No chunk contains a percentage or progress bar.
- The single-chunk and five-chunk layouts both match the prototype.
- Earlier chunks can be shown and hidden.
- Presentation name and slide range are editable.
- Both bottom buttons have touch targets of at least 40px.
- Terminology uses `chunks`, `attempts`, `Progress`, and `Ideal text` consistently.
