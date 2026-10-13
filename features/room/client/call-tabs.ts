import { z } from "zod";
import { logBrowserWarning } from "@/lib/telemetry.client";

/**
 * Calls open in other tabs of this browser, over a BroadcastChannel. A tab in a call says so
 * when it joins, answers whoever asks, says when it leaves, and leaves when another tab takes
 * over. The pre-join screen keeps the list, to ask before joining a second call.
 * Without BroadcastChannel (SSR, old browsers) there is no check: `openCallTabs` returns undefined.
 */
export const CALL_CHANNEL_NAME = "nelcota:call";

const callTabMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("query"), from: z.string().min(1) }),
  z.object({ type: z.literal("active"), from: z.string().min(1), code: z.string().min(1) }),
  z.object({ type: z.literal("ended"), from: z.string().min(1) }),
  z.object({ type: z.literal("leave"), from: z.string().min(1), target: z.string().min(1) }),
]);

export type CallTabMessage = z.infer<typeof callTabMessageSchema>;

/** Calls in other tabs: tab id → room code. */
export type OtherTabCalls = ReadonlyMap<string, string>;

export const NO_OTHER_TAB_CALLS: OtherTabCalls = new Map();

/** The message, or `undefined` for anything else on the channel (other versions, garbage). */
export function parseCallTabMessage(data: unknown): CallTabMessage | undefined {
  const parsed = callTabMessageSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return parsed.data;
}

/** The list after a message: "active" adds or updates a tab, "ended" removes it. */
export function applyCallTabMessage(calls: OtherTabCalls, message: CallTabMessage): OtherTabCalls {
  if (message.type === "active") {
    if (calls.get(message.from) === message.code) return calls;
    return new Map(calls).set(message.from, message.code);
  }
  if (message.type !== "ended" || !calls.has(message.from)) return calls;
  const next = new Map(calls);
  next.delete(message.from);
  return next;
}

/** Room code of a call in another tab, if any. */
export function firstOtherTabCall(calls: OtherTabCalls): string | undefined {
  const [first] = calls.values();
  return first;
}

/** A channel between this site's tabs: BroadcastChannel in the browser, a fake one in tests. */
export interface CallChannel {
  send: (message: CallTabMessage) => void;
  /** Returns the function that stops listening. */
  listen: (listener: (data: unknown) => void) => () => void;
  close: () => void;
}

type CallChannelFactory = (name: string) => CallChannel | undefined;

function adaptBroadcastChannel(channel: BroadcastChannel): CallChannel {
  return {
    // BroadcastChannel takes no target origin: it only ever reaches this site's own tabs.
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    send: (message) => channel.postMessage(message),
    listen: (listener) => {
      const receive = (event: MessageEvent) => listener(event.data);
      channel.addEventListener("message", receive);
      return () => channel.removeEventListener("message", receive);
    },
    close: () => channel.close(),
  };
}

function browserCallChannel(name: string): CallChannel | undefined {
  if (typeof BroadcastChannel === "undefined") return undefined;
  try {
    return adaptBroadcastChannel(new BroadcastChannel(name));
  } catch (error) {
    logBrowserWarning("Could not open the call channel between tabs", error);
    return undefined;
  }
}

let tabId: string | undefined;

/** randomUUID only exists in secure contexts (HTTPS, localhost); a LAN address has none. */
function newTabId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** This tab's id, the same for every channel the tab opens. */
function currentTabId(): string {
  tabId ??= newTabId();
  return tabId;
}

export interface CallTabs {
  /** Says this tab is in a call in `code` until the returned stop runs (idempotent). */
  announceCall: (code: string, onLeaveRequested: () => void) => () => void;
  /** Keeps `onChange` up to date with the calls in other tabs until the returned stop runs. */
  watchOtherCalls: (onChange: (calls: OtherTabCalls) => void) => () => void;
  /** Asks the tabs in `calls` to leave their calls. */
  askToLeave: (calls: OtherTabCalls) => void;
  close: () => void;
}

interface CallTabsOptions {
  tabId?: string;
  createChannel?: CallChannelFactory;
}

/** Opens the channel between tabs, or `undefined` when the browser has none. */
export function openCallTabs(options: CallTabsOptions = {}): CallTabs | undefined {
  const opened = (options.createChannel ?? browserCallChannel)(CALL_CHANNEL_NAME);
  if (opened === undefined) return undefined;
  const channel: CallChannel = opened;
  const self = options.tabId ?? currentTabId();
  const listeners = new Set<(message: CallTabMessage) => void>();

  const stopReceiving = channel.listen((data) => {
    const message = parseCallTabMessage(data);
    if (message === undefined || message.from === self) return;
    for (const listener of listeners) listener(message);
  });

  function listen(listener: (message: CallTabMessage) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function announceCall(code: string, onLeaveRequested: () => void): () => void {
    const active: CallTabMessage = { type: "active", from: self, code };
    const unlisten = listen((message) => {
      if (message.type === "query") channel.send(active);
      if (message.type === "leave" && message.target === self) onLeaveRequested();
    });
    channel.send(active);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      unlisten();
      channel.send({ type: "ended", from: self });
    };
  }

  function watchOtherCalls(onChange: (calls: OtherTabCalls) => void): () => void {
    let calls = NO_OTHER_TAB_CALLS;
    const unlisten = listen((message) => {
      const next = applyCallTabMessage(calls, message);
      if (next === calls) return;
      calls = next;
      onChange(calls);
    });
    channel.send({ type: "query", from: self });
    return unlisten;
  }

  function askToLeave(calls: OtherTabCalls) {
    for (const target of calls.keys()) channel.send({ type: "leave", from: self, target });
  }

  return {
    announceCall,
    watchOtherCalls,
    askToLeave,
    close: () => {
      listeners.clear();
      stopReceiving();
      channel.close();
    },
  };
}
