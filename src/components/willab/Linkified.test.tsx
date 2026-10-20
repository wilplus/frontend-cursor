// @vitest-environment jsdom
/*
STORY    As a speaker reading Will's message, I want links in a message to be
         clickable, so that I can open the booking page.
OUTCOME
  O1  A web address on its own, or inside a sentence, becomes a link;
      plain text stays plain.
PROVES   O1 -> "makes a bubble that is only a URL a link",
               "makes a URL inside a sentence a link and leaves plain text alone"
WHY      Founder 2026-10-18: the booking link was not clickable.
*/
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Linkified from "./Linkified";

const html = (text: string) => renderToStaticMarkup(createElement(Linkified, { text }));

describe("Linkified", () => {
  it("makes a bubble that is only a URL a link", () => {
    expect(html("https://www.willpowerlab.com/book/artur")).toContain(
      'href="https://www.willpowerlab.com/book/artur"',
    );
  });

  it("makes a URL inside a sentence a link and leaves plain text alone", () => {
    expect(html("Book here: https://www.willpowerlab.com/book/artur.")).toContain("<a ");
    expect(html("No link here.")).not.toContain("<a ");
  });
});
