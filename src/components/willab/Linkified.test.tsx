// @vitest-environment jsdom
/* A link Will sends works whether it sits in a sentence or is the whole
   bubble (founder 2026-10-18: the booking link under the answer was not
   clickable). */
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
