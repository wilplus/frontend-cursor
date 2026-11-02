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

export const joinTitle = (name: string) => `${name} asks you to join them on WillpowerLab`;
export const joinChatWith = (name: string) => `A chat with ${name}`;
export const JOIN_WILL_LINE = "Your own chat with Will, your speaking coach";
export const JOIN_NOBODY_ELSE = "Nobody else can reach you here unless you open their link too.";
export const JOIN_BUTTON = "Join";
export const JOIN_NOTHING_TO_INSTALL = "Opens in your browser. Nothing to install.";

export const joinedThrough = (name: string) => `You joined through ${name}'s link. Only the two of you are in this chat.`;
