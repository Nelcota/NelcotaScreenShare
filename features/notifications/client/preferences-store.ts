import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  readNotificationPreferences,
  type NotificationPreferences,
} from "@/features/notifications/domain/preferences";
import { useStoredValue } from "@/lib/hooks/use-stored-value";
import { createStoredValue } from "@/lib/stored-value";

function parse(raw: string): NotificationPreferences {
  try {
    return readNotificationPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

const preferences = createStoredValue<NotificationPreferences>({
  key: "nelcota-notification-preferences",
  changeEvent: "nelcota-notification-preferences-change",
  fallback: DEFAULT_NOTIFICATION_PREFERENCES,
  parse,
  serialize: (value) => JSON.stringify(value),
  warning: "Could not access notification preferences storage",
});

/** The same object while the saved value does not change (`useSyncExternalStore`). */
export const currentNotificationPreferences = preferences.read;

export function updateNotificationPreferences(change: Partial<NotificationPreferences>) {
  preferences.write(Object.freeze({ ...preferences.read(), ...change }));
}

export function useNotificationPreferences(): NotificationPreferences {
  return useStoredValue(preferences, DEFAULT_NOTIFICATION_PREFERENCES);
}
