import { logBrowserWarning } from "@/lib/telemetry.client";

export type ChatNotificationSound = "soft" | "chime" | "off";
const STORAGE_KEY = "nelcota-chat-notification-sound";
const CHANGE_EVENT = "nelcota-chat-sound-change";
let fallback: ChatNotificationSound = "soft";
let warned = false;
let storageBlocked = false;

export function isChatNotificationSound(value: unknown): value is ChatNotificationSound {
  return value === "soft" || value === "chime" || value === "off";
}

function warnStorage(error: unknown) {
  if (warned) return;
  warned = true;
  logBrowserWarning("Could not save or read the chat sound preference", error);
}

export function currentChatSound(): ChatNotificationSound {
  if (typeof window === "undefined" || storageBlocked) return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isChatNotificationSound(stored) ? stored : fallback;
  } catch (error) {
    storageBlocked = true;
    warnStorage(error);
    return fallback;
  }
}

export function setChatSound(sound: ChatNotificationSound) {
  fallback = sound;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, sound);
  } catch (error) {
    storageBlocked = true;
    warnStorage(error);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeChatSound(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
