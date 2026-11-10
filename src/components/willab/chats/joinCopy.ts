/* -------------------------------------------------------------------------- */
/*  The join link's words, all signed (Never 4): the add sheet (backend N310  */
/*  item 3), the join page (N601; was N310 item 3, N335 item 2) and its button (N307    */
/*  item 3), and the line in the chat of the one who joined (N335 item 2).    */
/*  "Join with your {company} account" (N335) waits until there is a company  */
/*  to name; until then the button is "Join" (N307).                           */
/* -------------------------------------------------------------------------- */

export const ADD_SHEET_TITLE = "Add someone to chat with";
export const COPY_MY_LINK = "Copy my link";
/** The add sheet as redesigned (backend N367 item 3), signed. */
export const COPIED = "✓ Copied";
export const CANCEL = "Cancel";

/** The join page in three lines (backend N601 items 1 and 3, signed). */
export const joinInvited = (name: string) => `${name} invited you`;
export const JOIN_ONLY_THE_TWO_OF_YOU = "Only the two of you are in this chat.";
export const JOIN_BUTTON = "Join";

export const joinedThrough = (name: string) => `You joined through ${name}'s link. Only the two of you are in this chat.`;

/* The lines at the top of a chat made through a link, once its owner's
 * questions are built (backend N487; signed in N496 and N502). */
/** The one who joined, when the link's owner set questions (N496 item 1). */
export const joinedAsks = (name: string) => `You joined thanks to ${name}. A few questions first, then you build a knowledge base together.`;
/** The one who joined, when the owner set none (N496 item 2). */
export const joinedThanks = (name: string) => `You joined thanks to ${name}. Your first question starts the knowledge base you build together.`;
/** The link's owner (N502 item 5). */
export const joinedYourLink = (name: string) => `${name} joined through your link.`;
/** The card the owner reads once the joiner is done (N502 item 5). */
export const answersOf = (name: string) => `${name}'s answers`;
/** In the bar's middle, once a question that takes more than one answer has one picked (N502 item 3). */
export const SEND_PICKED = "Send";

/* Will's setup for the one who shares (backend N487 items 2 and 3, N503;
 * signed in N502 item 1). Will's own lines come from the backend. */
/** The summary's line when nothing is asked. */
export const JOIN_SETUP_NONE = "No questions, just the line above.";
/** The "+"'s note at the bottom until the questions are set (backend N534). */
export const SETUP_NOTE = "Before you share your link, set the questions for people who join.";
export const SET_THEM = "Set them";
/** Opens the summary again, later. */
export const YOUR_JOIN_QUESTIONS = "Your questions for people who join";

/** An asking chat, a matched Take that reached you (backend N485): signed
 *  with N493 item 7 (Never 4). */
export const asksYouAbout = (topic: string) => `Asks you about ${topic}`;
export const askingForWhatYouKnow = (pseudonym: string) =>
  `${pseudonym} is asking for what you know. Your answer starts a knowledge base you build together.`;
export const itsAbout = (topic: string) => `It's about ${topic.replace(/[.\s]+$/, "")}.`;

/* Your chat on any website (backend N567; all signed, founder 2026-11-05). */
/** The add sheet's card under its title, with the small switch. */
export const WEBSITE_SWITCH = "Put this chat on your website";
export const WEBSITE_LINE =
  "Customers ask you there, and you answer here. Each answer teaches your chat, so it learns from real questions as they come in.";
/** Under the code, once the switch is on. */
export const PASTE_LINE = "Paste this line just before </body> on your website, or send it to whoever builds your site.";
export const COPY_MY_CODE = "Copy my code";
/** The one line left of the three tiles; and its twin for the code. */
export const ONLY_THE_TWO_OF_YOU = "Only the two of you are in it.";
export const EACH_CUSTOMER = "Each customer has a chat of their own with you.";
/** The line of code the switch shows: the link's token, on this site's w.js. */
export const widgetCode = (origin: string, token: string) =>
  `<script src="${origin}/w.js" data-link="${token}" async></script>`;

/** The website chat on someone's site (`/w/<token>`; N567, N591, N595).
 *  Signed: the pill, "with WillpowerLab", Send, Not now, Sign up (the
 *  sign-up page's own button). */
export const askName = (name: string) => `Ask ${name}`;
export const WITH_WILLPOWERLAB = "with WillpowerLab";
export const NOT_NOW = "Not now";
export const SIGN_UP = "Sign up";

/** The sign-up step after asking, the line after it and the notice: signed
 *  by the founder, N595 item 2 (Never 4). */
export const widgetSignUpLine = (name: string) => `To get ${name}'s answer, sign up.`;
export const WIDGET_SIGN_UP_NOTE = "The first notice of the answer comes to your phone or email. After that, this chat is yours.";
export const widgetSignedUp = (to: "phone" | "email") => `Signed up. The first notice of the answer comes to your ${to}.`;

/** RETIRED by N595 item 1 (the consent card) and N591 item 5 (and N569 item
 *  2): shown nowhere. Kept only while the backend's App Model stories still
 *  name them (WID-13, WID-14, WID-18, WID-24,
 *  docs/design/app-model-2026-11-09/stories.json; npm run check:app-model);
 *  delete them once those stories follow N591 and N595. */
export const widgetConsent = (name: string) => `Your taps go to ${name} through WillpowerLab.`;
export const widgetHello = (name: string) => `Hi, I'm ${name}. Tap to answer, and I'll answer you out loud.`;
export const widgetWaits = (name: string) => `${name} answers out loud when there's a moment. Come back here to listen.`;
export const keepLine = (name: string) => `Join WillpowerLab to keep it, and hear ${name}'s answers on your phone.`;
