/**
 * What changed, sent to the browser as a nudge with no data: the page reloads its own
 * loaders, which still decide what each person may see. A ring also carries the card's
 * data, so the callee sees it before the reload.
 */
export type LiveTopic = "friends" | "status" | "messages" | "ring" | "session";

/** The SSE event name the browser listens to. */
export const NUDGE_EVENT = "nudge";

/**
 * The SSE event a stream sends just before closing because its session is gone (ended in
 * another browser, a password reset, a block): the tab sends the person to sign in.
 */
export const SESSION_ENDED_EVENT = "session-ended";

/** The SSE event of a nudge that carries data: `{ topic, data }` as JSON. */
export const DATA_EVENT = "data";

/**
 * The window event a tab fires for every nudge of a topic, for what must react at once.
 * Its detail is the data, or null for a plain nudge.
 */
export const liveWindowEvent = (topic: string) => `nelcota-live-${topic}`;
