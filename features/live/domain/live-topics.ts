/**
 * What changed, sent to the browser as a nudge with no data: the page reloads its own
 * loaders, which still decide what each person may see.
 */
export type LiveTopic = "friends" | "status";

/** The SSE event name the browser listens to. */
export const NUDGE_EVENT = "nudge";
