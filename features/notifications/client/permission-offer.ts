import { useSyncExternalStore } from "react";
import { shouldOfferPermission } from "@/features/notifications/domain/notifier";
import { PROMPT_SNOOZE_MS } from "@/features/notifications/domain/preferences";
import {
  requestBrowserPermission,
  useBrowserPermission,
} from "@/features/notifications/client/notify";
import {
  updateNotificationPreferences,
  useNotificationPreferences,
} from "@/features/notifications/client/preferences-store";

const OFFER_EVENT = "nelcota-notification-offer";
/** When this page first asked to offer; null until then. */
let askedAt: number | null = null;

/**
 * The moments to offer notifications, with the tab in front: opening a conversation, the first
 * Chamar. Shows the offer only if the browser would still ask and it is not snoozed.
 */
export function offerNotifications() {
  if (askedAt !== null || typeof window === "undefined") return;
  askedAt = Date.now();
  window.dispatchEvent(new Event(OFFER_EVENT));
}

function subscribe(changed: () => void) {
  window.addEventListener(OFFER_EVENT, changed);
  return () => window.removeEventListener(OFFER_EVENT, changed);
}

/** The offer line: whether it shows, "Ativar" and "Agora não" (a week of quiet). */
export function usePermissionOffer() {
  const requestedAt = useSyncExternalStore(
    subscribe,
    () => askedAt,
    () => null,
  );
  const permission = useBrowserPermission();
  const preferences = useNotificationPreferences();
  const visible =
    requestedAt !== null && shouldOfferPermission(permission, preferences, requestedAt);
  return {
    visible,
    enable: () => void requestBrowserPermission(),
    later: () =>
      updateNotificationPreferences({ promptSnoozedUntil: Date.now() + PROMPT_SNOOZE_MS }),
  };
}
