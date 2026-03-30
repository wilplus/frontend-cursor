/** Strip tags for search/plain display (client-safe). */
export function stripHtmlToText(input: string | null | undefined): string {
  if (!input) return "";
  if (typeof window === "undefined") return input;
  const div = document.createElement("div");
  div.innerHTML = input;
  return (div.textContent || div.innerText || "").trim();
}

/**
 * Whitelist sanitizer for instructional rich text (bold, lists, links, etc.).
 * Matches student-facing prompt rendering in the recorder.
 */
export function sanitizeRichHtml(input: string): string {
  if (!input) return "";
  if (typeof window === "undefined") return input;
  const container = document.createElement("div");
  container.innerHTML = input;
  const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "BR", "P", "UL", "OL", "LI", "A", "H1", "H2", "H3", "H4", "H5", "H6"]);

  const sanitizeNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode("");
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (!allowedTags.has(tag)) {
      const fragment = document.createDocumentFragment();
      Array.from(el.childNodes).forEach((child) => {
        const cleanChild = sanitizeNode(child);
        if (cleanChild) fragment.appendChild(cleanChild);
      });
      return fragment;
    }
    const cleanEl = document.createElement(tag.toLowerCase());
    if (tag === "A") {
      const hrefRaw = (el.getAttribute("href") || "").trim();
      if (/^(https?:|mailto:|tel:|\/|#)/i.test(hrefRaw)) {
        cleanEl.setAttribute("href", hrefRaw);
      }
      cleanEl.setAttribute("target", "_blank");
      cleanEl.setAttribute("rel", "noopener noreferrer");
    }
    Array.from(el.childNodes).forEach((child) => {
      const cleanChild = sanitizeNode(child);
      if (cleanChild) cleanEl.appendChild(cleanChild);
    });
    return cleanEl;
  };

  const output = document.createElement("div");
  Array.from(container.childNodes).forEach((child) => {
    const clean = sanitizeNode(child);
    if (clean) output.appendChild(clean);
  });
  return output.innerHTML;
}

/** Tailwind classes aligned with admin rich-text editor (warm-up / task modals). */
export const adminRichTextContentClassName =
  "min-w-0 flex-1 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 break-words";
