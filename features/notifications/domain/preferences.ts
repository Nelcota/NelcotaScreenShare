/** This browser's notification choices (each device decides for itself). */
export interface NotificationPreferences {
  /** Ring when someone calls you. */
  ringSound: boolean;
  /** Show system notifications while the tab is in the background (needs the permission). */
  browserNotifications: boolean;
  /** "Agora não" on our offer: it stays quiet until this time (ms); /conta still asks. */
  promptSnoozedUntil: number;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = Object.freeze({
  ringSound: true,
  browserNotifications: true,
  promptSnoozedUntil: 0,
});

/** How long "Agora não" keeps the offer away. */
export const PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60_000;

function savedValue(saved: object, key: keyof NotificationPreferences): unknown {
  return Object.getOwnPropertyDescriptor(saved, key)?.value;
}

function booleanOr(saved: object, key: "ringSound" | "browserNotifications"): boolean {
  const value = savedValue(saved, key);
  if (typeof value === "boolean") return value;
  return DEFAULT_NOTIFICATION_PREFERENCES[key];
}

function timeOr(saved: object, key: "promptSnoozedUntil"): number {
  const value = savedValue(saved, key);
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return DEFAULT_NOTIFICATION_PREFERENCES[key];
}

/** Saved preferences; anything missing or invalid keeps its default. */
export function readNotificationPreferences(saved: unknown): NotificationPreferences {
  if (!saved || typeof saved !== "object") return DEFAULT_NOTIFICATION_PREFERENCES;
  return Object.freeze({
    ringSound: booleanOr(saved, "ringSound"),
    browserNotifications: booleanOr(saved, "browserNotifications"),
    promptSnoozedUntil: timeOr(saved, "promptSnoozedUntil"),
  });
}
