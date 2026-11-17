/*
STORY    Build, a row's chat and the talk wear the same top bar and the
         same bottom bar as every other chat.
OUTCOME
  O1  The locked bar is the content rail, 60px, with the chat's own
      composer. The builder does not draw a second one.
PROVES   O1 -> "the builder uses the locked top bar and the locked composer"
*/
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("the locked bars", () => {
  it("the builder uses the locked top bar and the locked composer", () => {
    const top = read("src/components/willab/chats/TopBar.tsx");
    const thread = read("src/components/willab/chats/ChatThread.tsx");
    const build = read("src/components/willab/chats/WillBuild.tsx");
    const talk = read("src/components/willab/chats/hostsetup/TalkBuild.tsx");
    expect(top).toContain("WILLAB_CONTENT_RAIL");
    expect(top).toContain("h-[60px]");
    expect(thread).toContain('data-chat-bar className="flex min-h-[60px] shrink-0 items-center gap-1 p-2"');
    expect(build).toContain("<TopBar");
    expect(build).not.toContain("data-part-chat-bar");
    expect(talk).toContain("BarBox");
    expect(talk).toContain('data-chat-bar=""');
    expect(talk).toContain("min-h-[60px] shrink-0 items-center gap-1 p-2");
    expect(talk).not.toContain("rounded-[28px]");
  });
});
