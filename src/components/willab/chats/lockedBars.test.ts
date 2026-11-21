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
    const header = read("src/components/willab/PageHeader.tsx");
    const bar = read("src/components/willab/chats/ChatBar.tsx");
    const thread = read("src/components/willab/chats/ChatThread.tsx");
    const build = read("src/components/willab/chats/WillBuild.tsx");
    const talk = read("src/components/willab/chats/hostsetup/TalkBuild.tsx");
    expect(top).toContain("PageHeader");
    expect(top).toContain("h-[60px]");
    expect(header).toContain("WILLAB_CONTENT_RAIL");
    expect(header).toContain("w-screen");
    expect(bar).toContain("export function ChatBarRow");
    expect(thread).toContain("<ChatBarRow>");
    expect(build).toContain("<TopBar");
    expect(build).toContain("rowOpen ? null : top");
    expect(build).not.toContain("data-part-chat-bar");
    expect(read("src/components/willab/chats/hostsetup/CodeStep.tsx")).toContain("<ChatBarRow");
    expect(talk).toContain("BarBox");
    expect(talk).toContain("<ChatBarRow");
    expect(talk).not.toContain("rounded-[28px]");
  });
});
