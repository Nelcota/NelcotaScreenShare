import { useSyncExternalStore } from "react";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  readNotificationPreferences,
  type NotificationPreferences,
} from "@/features/notifications/domain/preferences";
import { logBrowserWarning } from "@/lib/telemetry.client";

const STORAGE_KEY = "nelcota-notification-preferences";
const CHANGE_EVENT = "nelcota-notification-preferences-change";
let fallback: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
let storageBlocked = false;
let warned = false;
let cached: { raw: string | null; preferences: NotificationPreferences } | undefined;

function warn(error: unknown) {
  if (warned) return;
  warned = true;
  logBrowserWarning("Could not access notification preferences storage", error);
}

function parse(raw: string | null): NotificationPreferences {
  if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    return readNotificationPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

/** The same object while the saved value does not change (`useSyncExternalStore`). */
export function currentNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined" || storageBlocked) return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (cached?.raw !== raw) cached = { raw, preferences: parse(raw) };
    return cached.preferences;
  } catch (error) {
    storageBlocked = true;
    warn(error);
    return fallback;
  }
}

export function updateNotificationPreferences(change: Partial<NotificationPreferences>) {
  const next = Object.freeze({ ...currentNotificationPreferences(), ...change });
  fallback = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    storageBlocked = true;
    warn(error);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(changed: () => void) {
  window.addEventListener(CHANGE_EVENT, changed);
  window.addEventListener("storage", changed);
  return () => {
    window.removeEventListener(CHANGE_EVENT, changed);
    window.removeEventListener("storage", changed);
  };
}

export function useNotificationPreferences(): NotificationPreferences {
  return useSyncExternalStore(
    subscribe,
    currentNotificationPreferences,
    () => DEFAULT_NOTIFICATION_PREFERENCES,
  );
}
