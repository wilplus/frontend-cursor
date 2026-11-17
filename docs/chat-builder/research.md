# Conversational builders, compared

> **Label: Reference.** Founder-Approved: Artur, 17 November 2026, full-day goal, research the conversational builders. Each row cites the page that was read. The Presentation Builder was read from `origin/cursor/presentation-builder-reference` (`docs/chat-builder/reference/presentation-builder/`). That branch was not merged.

## What was compared

| Product | How you build | What we took | What we left |
| --- | --- | --- | --- |
| OpenAI GPT builder | Create is a chat that fills Configure. [Creating and editing GPTs](https://help.openai.com/en/articles/8554397-creating-and-editing-gpts). Simon Willison watched Create write the form: [GPTs](https://simonwillison.net/2023/Nov/15/gpts/). | One conversation that writes the config. The table stays the other view, never beside the chat. | Two panes at once. Whitespace's review shows they fight: [GPTs usability review](https://www.whitespace.ch/insights/gpts-usability-review/). |
| Claude Projects | Instructions and files, edited as fields. A newer beta is one conversation with side threads. [What are projects?](https://support.claude.com/en/articles/9517075-what-are-projects) | A stable page the result lives on (Your chat). | No stepper and no versions, so it is not the builder. |
| Poe | A server bot is a name, an access key, and a URL, plus a Python server. [Quick start](https://creator.poe.com/docs/quick-start) | Nothing from the form. | The whole flow. It is not a conversation. |
| Character.ai | A form: name, avatar, voice, greeting, tags, visibility, optional definition. [Creating a character](https://support.character.ai/hc/en-us/articles/50608869548699-2-Creating-a-Character-Quickstart-Guide-%CF%89) (updated 17 Jun 2026). | The greeting as the first thing people hear. | No undo, no one-question-at-a-time. |
| Voiceflow | A canvas plus an always-on prompt (Role, Goal). [Global prompt](https://www.voiceflow.com/docs/documentation/build/global-prompt) | The idea that the steps are the product. | The canvas. Too dense for this chat. |
| Botpress | A drag-and-drop studio, an Instructions field, and AI Task cards. [Studio](https://studio.botpress.cloud), [docs](https://botpress.com/docs) | One instruction in words. | The graph editor. |
| Typebot | A visual editor of bubbles. [Introduction](https://docs.typebot.com/get-started/introduction) | One question per step. | Dragging bubbles as the only way in. |
| Gamma | One prompt, then Plan mode with a few questions, tappable options, and "Decide for me". Nothing is built until you approve the plan. The mobile app edits only through the chat, and every box has dictation. [Create with Agent](https://help.gamma.app/en/articles/15002203-how-do-i-create-with-agent-in-gamma), [mobile app](https://help.gamma.app/en/articles/11016450-does-gamma-have-a-mobile-app) | Talk first, approve, then the thing. Dictate, review, send. | Express mode, which skips the plan. |
| Lovable and v0 | You describe an app and get a project you then edit in chat, with a preview and version history. [Lovable welcome](https://docs.lovable.dev/introduction/welcome), [v0 docs](https://v0.app/docs) | Prompt, then a result you can open. | Generating a whole app. This builder sets a chat, it does not invent pages. |
| The Presentation Builder | One file, keyword replies, `.wlp-*` and `--wlp-*`. Stepper Brief · Plan · Slides · Look. Undo chip. Version card. Orange quotes (`.wlp-say`, `#fff1e8` / `#c84d06`) that fill the composer and never send. Composer: 44px mic, borderless field, 44px send, 28px radius. Tap the mic to dictate. Hold it, and release sends. [Audit method](docs/chat-builder/reference/presentation-builder/audit-log.md) is on the reference branch: drive the flow, count what happened, score from that. | The stepper, the undo chip, the version pill, the quote fill, the composer, and the mic (tap, and hold to send). Brief / Steps / Coach / Look is the same shape as Brief / Plan / Slides / Look. | The deck renderer, themes, and slide layouts. |

## The pattern we take

The talk writes the chat. Your chat is the table, and it is a different screen. A quote fills the box. Yes and No are one question each. The price, the model, and a checked paste are answers in the same talk, by tap, by typing, or by the mic. Undo restores the previous version.
