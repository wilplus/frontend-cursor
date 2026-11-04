/* -------------------------------------------------------------------------- */
/*  The join link's words, all signed (Never 4): the add sheet (backend N310  */
/*  item 3), the join page (N310 item 3, N335 item 2) and its button (N307    */
/*  item 3), and the line in the chat of the one who joined (N335 item 2).    */
/*  "Join with your {company} account" (N335) waits until there is a company  */
/*  to name; until then the button is "Join" (N307).                           */
/* -------------------------------------------------------------------------- */

export const ADD_SHEET_TITLE = "Add someone to chat with";
export const ADD_SHEET_LINE = "Send them your link, in any email or message. Whoever opens it joins you here.";
export const COPY_MY_LINK = "Copy my link";
/** The add sheet as redesigned (backend N367 item 3), signed. */
export const COPIED = "✓ Copied";
export const ADD_STEPS = [
  ["1. Paste it", "in an email or a message you send anyway"],
  ["2. They open it", "and join with their account"],
  ["3. You chat", "Only the two of you are in it"],
] as const;
export const CANCEL = "Cancel";

export const joinTitle = (name: string) => `${name} asks you to join them on WillpowerLab`;
export const joinChatWith = (name: string) => `A chat with ${name}`;
export const JOIN_WILL_LINE = "Your own chat with Will, your speaking coach";
export const JOIN_NOBODY_ELSE = "Nobody else can reach you here unless you open their link too.";
export const JOIN_BUTTON = "Join";
export const JOIN_NOTHING_TO_INSTALL = "Opens in your browser. Nothing to install.";

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
