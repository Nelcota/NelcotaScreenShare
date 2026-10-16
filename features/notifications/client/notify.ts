import { useSyncExternalStore } from "react";
import {
  createNotifier,
  type NotifyHandle,
  type NotifyOptions,
  type PermissionState,
} from "@/features/notifications/domain/notifier";
import {
  currentNotificationPreferences,
  updateNotificationPreferences,
} from "@/features/notifications/client/preferences-store";
import { playCallEnd, startRing } from "@/features/notifications/client/ring";
import type { CallEnd } from "@/features/notifications/domain/call-end-sounds";
import {
  prepareSystemNotifications,
  showSystemNotification,
} from "@/features/notifications/client/system-notification";
import { addUnread } from "@/features/notifications/client/unread-store";
import { logBrowserWarning } from "@/lib/telemetry.client";

export type { NotifyHandle, NotifyOptions } from "@/features/notifications/domain/notifier";

function browserPermission(): PermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

const PERMISSION_EVENT = "nelcota-notification-permission-change";

function subscribePermission(changed: () => void) {
  window.addEventListener(PERMISSION_EVENT, changed);
  // Changed in the site settings while the tab was in the background.
  window.addEventListener("focus", changed);
  return () => {
    window.removeEventListener(PERMISSION_EVENT, changed);
    window.removeEventListener("focus", changed);
  };
}

/** The permission as the browser reports it; "default" during SSR. */
export function useBrowserPermission(): PermissionState {
  return useSyncExternalStore(subscribePermission, browserPermission, () => "default");
}

/** The browser's own prompt. Call it only from a click (ours or in /conta). */
export async function requestBrowserPermission(): Promise<PermissionState> {
  if (typeof Notification === "undefined") return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    window.dispatchEvent(new Event(PERMISSION_EVENT));
    if (permission === "granted") {
      updateNotificationPreferences({ browserNotifications: true });
      prepareSystemNotifications();
    }
    return permission;
  } catch (error) {
    logBrowserWarning("Could not ask for the notification permission", error);
    return browserPermission();
  }
}

let notifier: ((options: NotifyOptions) => NotifyHandle) | undefined;

/**
 * Calls ("Bruno está te chamando") and messages ("Nova mensagem de Bruno"): rings for
 * calls, counts on the tab while it is in the background and shows a system notification
 * there. What appears inside the page stays with the feature that calls it.
 */
export function notify(options: NotifyOptions): NotifyHandle {
  if (typeof window === "undefined") return { close: () => {} };
  notifier ??= createNotifier({
    isHidden: () => document.visibilityState === "hidden",
    permission: browserPermission,
    preferences: currentNotificationPreferences,
    showSystem: showSystemNotification,
    startRing,
    addUnread,
    after: (milliseconds, run) => {
      const timer = window.setTimeout(run, milliseconds);
      return () => window.clearTimeout(timer);
    },
  });
  return notifier(options);
}

/** A short sound when a call ends: "Ninguém atendeu" for the caller, a click on Recusar. */
export function playCallEndSound(kind: CallEnd) {
  if (typeof window === "undefined") return;
  if (!currentNotificationPreferences().ringSound) return;
  playCallEnd(kind);
}
