import { useSyncExternalStore } from "react";
import { logBrowserWarning } from "@/lib/telemetry.client";

/**
 * A call waiting for its caller to get into the room: the ring goes out only once they are
 * connected, so the friend never arrives before them. Kept in this tab only.
 */
export type PendingCall =
  | { room: string; kind: "friend"; friendId: string; name: string }
  | { room: string; kind: "group"; conversationId: string; name: string };

const STORAGE_KEY = "nelcota-pending-call";
const CHANGE_EVENT = "nelcota-pending-call-change";

function read(): PendingCall | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !("room" in parsed)) return null;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- written only by save() below.
    return parsed as PendingCall;
  } catch (error) {
    logBrowserWarning("Could not read the pending call", error);
    return null;
  }
}

let cachedRaw: string | null = null;
let cached: PendingCall | null = null;

function snapshot(): PendingCall | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = read();
  return cached;
}

function subscribe(changed: () => void) {
  window.addEventListener(CHANGE_EVENT, changed);
  return () => window.removeEventListener(CHANGE_EVENT, changed);
}

export function savePendingCall(call: PendingCall | null): void {
  try {
    if (call) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(call));
    if (!call) window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    logBrowserWarning("Could not save the pending call", error);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePendingCall(): PendingCall | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
