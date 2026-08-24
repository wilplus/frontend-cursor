/* -------------------------------------------------------------------------- */
/*  sse — minimal incremental parser for a text/event-stream body.             */
/*                                                                            */
/*  Why not EventSource: it cannot send an Authorization header, and the       */
/*  readout BFF forwards authenticated or signed Guest ID ownership. A         */
/*  fetch()-driven reader keeps exact ownership parity with                    */
/*  fetchGuestLabReadout, at the cost of hand-parsing frames — which is this   */
/*  file, kept dependency-free and unit-tested.                                */
/* -------------------------------------------------------------------------- */

export interface SseEvent {
  /** The frame's `event:` field; `"message"` when absent (SSE default). */
  event: string;
  /** All `data:` lines of the frame, joined with newlines (SSE spec). */
  data: string;
}

/**
 * Incremental parser: feed decoded chunks in whatever split the network
 * produced; complete frames come back per call, partial ones stay buffered.
 * Comment lines (`: ping` heartbeats) and unknown fields are dropped per the
 * SSE spec; frames with no `data:` line emit nothing.
 */
export function createSseFrameParser(): (chunk: string) => SseEvent[] {
  // Normalized (\n-only), not-yet-parsed remainder of the stream.
  let tail = "";
  // A chunk that ends exactly on the \r of a \r\n pair: the \r is normalized
  // to \n now, and the pair's \n is swallowed when the next chunk arrives.
  let heldCR = false;

  return (chunk: string): SseEvent[] => {
    if (heldCR) {
      if (chunk.startsWith("\n")) chunk = chunk.slice(1);
      heldCR = false;
    }
    if (chunk.endsWith("\r")) heldCR = true;
    tail += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    const events: SseEvent[] = [];
    let sep: number;
    while ((sep = tail.indexOf("\n\n")) !== -1) {
      const frame = tail.slice(0, sep);
      tail = tail.slice(sep + 2);

      let event = "message";
      const data: string[] = [];
      for (const line of frame.split("\n")) {
        if (!line || line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      if (data.length > 0) events.push({ event, data: data.join("\n") });
    }
    return events;
  };
}
