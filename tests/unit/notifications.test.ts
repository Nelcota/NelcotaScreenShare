import { describe, expect, it, vi } from "vitest";
import {
  CALL_END_SOUNDS,
  MESSAGE_SOUND,
  RING_VOLUME,
  soundLength,
} from "@/features/notifications/domain/call-end-sounds";
import {
  createNotifier,
  RING_TIMEOUT_MS,
  shouldOfferPermission,
  type NotifierEnvironment,
  type PermissionState,
} from "@/features/notifications/domain/notifier";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  PROMPT_SNOOZE_MS,
  readNotificationPreferences,
  type NotificationPreferences,
} from "@/features/notifications/domain/preferences";
import { badgeLabel, titleWithUnread } from "@/features/notifications/domain/unread";

describe("unread count on the tab", () => {
  it("puts the count in front of the title and removes it at zero", () => {
    expect(titleWithUnread("Nelcota", 3)).toBe("(3) Nelcota");
    expect(titleWithUnread("(3) Nelcota", 4)).toBe("(4) Nelcota");
    expect(titleWithUnread("(4) Nelcota", 0)).toBe("Nelcota");
    expect(titleWithUnread("Sala · Nelcota", 0)).toBe("Sala · Nelcota");
  });

  it("caps the label at 9+", () => {
    expect(badgeLabel(9)).toBe("9");
    expect(badgeLabel(12)).toBe("9+");
    expect(titleWithUnread("(9+) Nelcota", 15)).toBe("(9+) Nelcota");
  });
});

describe("notification preferences", () => {
  it("plays the call sounds unless they were turned off", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.callSounds).toBe(true);
    expect(readNotificationPreferences({ callSounds: false }).callSounds).toBe(false);
  });

  it("keeps valid saved choices and defaults the rest", () => {
    expect(readNotificationPreferences({ ringSound: false, promptSnoozedUntil: "soon" })).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ringSound: false,
    });
  });

  it.each([null, "on", 3])("falls back to the defaults for %j", (saved) => {
    expect(readNotificationPreferences(saved)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("offers only while the browser would still ask, and not in the week after Agora não", () => {
    const preferences = DEFAULT_NOTIFICATION_PREFERENCES;
    const now = 1_000_000;
    expect(shouldOfferPermission("default", preferences, now)).toBe(true);
    expect(shouldOfferPermission("granted", preferences, now)).toBe(false);
    expect(shouldOfferPermission("denied", preferences, now)).toBe(false);
    expect(shouldOfferPermission("unsupported", preferences, now)).toBe(false);
    expect(
      shouldOfferPermission("default", { ...preferences, browserNotifications: false }, now),
    ).toBe(false);
    const snoozed = { ...preferences, promptSnoozedUntil: now + PROMPT_SNOOZE_MS };
    expect(shouldOfferPermission("default", snoozed, now + PROMPT_SNOOZE_MS - 1)).toBe(false);
    expect(shouldOfferPermission("default", snoozed, now + PROMPT_SNOOZE_MS)).toBe(true);
  });
});

function fakeEnvironment({
  hidden = false,
  permission = "granted",
  preferences = DEFAULT_NOTIFICATION_PREFERENCES,
}: {
  hidden?: boolean;
  permission?: PermissionState;
  preferences?: NotificationPreferences;
} = {}) {
  const ring = { stop: vi.fn() };
  const system = { close: vi.fn() };
  const cancelTimeout = vi.fn();
  let timeout: (() => void) | undefined;
  const environment = {
    isHidden: () => hidden,
    permission: () => permission,
    preferences: () => preferences,
    showSystem: vi.fn(() => system),
    startRing: vi.fn(() => ring),
    playMessage: vi.fn(),
    addUnread: vi.fn(),
    after: vi.fn((_milliseconds: number, run: () => void) => {
      timeout = run;
      return cancelTimeout;
    }),
  } satisfies NotifierEnvironment;
  return { environment, ring, system, cancelTimeout, fireTimeout: () => timeout?.() };
}

describe("message sound", () => {
  it("plays a short, quiet sound for a new message, on by default", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.messageSound).toBe(true);
    expect(readNotificationPreferences({ messageSound: false }).messageSound).toBe(false);
    expect(soundLength(MESSAGE_SOUND.notes)).toBeLessThan(0.3);
    expect(MESSAGE_SOUND.volume).toBeLessThan(RING_VOLUME);
  });

  it("sounds for a message, in front or in the background, unless turned off", () => {
    const open = fakeEnvironment();
    createNotifier(open.environment)({ kind: "message", title: "Nova mensagem de Bia" });
    expect(open.environment.playMessage).toHaveBeenCalledTimes(1);
    expect(open.environment.startRing).not.toHaveBeenCalled();
    const quiet = fakeEnvironment({
      preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, messageSound: false },
    });
    createNotifier(quiet.environment)({ kind: "message", title: "Nova mensagem de Bia" });
    expect(quiet.environment.playMessage).not.toHaveBeenCalled();
    const call = fakeEnvironment();
    createNotifier(call.environment)({ kind: "call", title: "Bia está te chamando" });
    expect(call.environment.playMessage).not.toHaveBeenCalled();
  });
});

describe("notify", () => {
  it("rings for a call in the open tab, without counting or a system notification", () => {
    const fake = fakeEnvironment();
    const handle = createNotifier(fake.environment)({
      kind: "call",
      title: "Bruno está te chamando",
    });
    expect(fake.environment.startRing).toHaveBeenCalledOnce();
    expect(fake.environment.after).toHaveBeenCalledWith(RING_TIMEOUT_MS, expect.any(Function));
    expect(fake.environment.addUnread).not.toHaveBeenCalled();
    expect(fake.environment.showSystem).not.toHaveBeenCalled();
    handle.close();
    handle.close();
    expect(fake.ring.stop).toHaveBeenCalledOnce();
    expect(fake.cancelTimeout).toHaveBeenCalledOnce();
  });

  it("stops an unanswered ring after the timeout", () => {
    const fake = fakeEnvironment();
    createNotifier(fake.environment)({ kind: "call", title: "Bruno está te chamando" });
    fake.fireTimeout();
    expect(fake.ring.stop).toHaveBeenCalledOnce();
  });

  it("counts and shows a system notification with actions in the background", () => {
    const fake = fakeEnvironment({ hidden: true });
    const onAction = vi.fn();
    const actions = [
      { id: "entrar", label: "Entrar" },
      { id: "recusar", label: "Recusar", opensApp: false },
    ];
    const handle = createNotifier(fake.environment)({
      kind: "call",
      title: "Bruno está te chamando",
      tag: "chamada-bruno",
      actions,
      onAction,
    });
    expect(fake.environment.addUnread).toHaveBeenCalledOnce();
    expect(fake.environment.showSystem).toHaveBeenCalledWith({
      title: "Bruno está te chamando",
      body: undefined,
      tag: "chamada-bruno",
      actions,
      onAction,
    });
    handle.close();
    expect(fake.system.close).toHaveBeenCalledOnce();
  });

  it("does not ring for a message, nor when the ring sound is off", () => {
    const message = fakeEnvironment({ hidden: true });
    createNotifier(message.environment)({ kind: "message", title: "Nova mensagem de Bruno" });
    expect(message.environment.startRing).not.toHaveBeenCalled();
    expect(message.environment.showSystem).toHaveBeenCalledOnce();

    const silent = fakeEnvironment({
      preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, ringSound: false },
    });
    createNotifier(silent.environment)({ kind: "call", title: "Bruno está te chamando" });
    expect(silent.environment.startRing).not.toHaveBeenCalled();
  });

  it("skips the system notification without permission or when turned off", () => {
    const denied = fakeEnvironment({ hidden: true, permission: "denied" });
    createNotifier(denied.environment)({ kind: "message", title: "Nova mensagem de Bruno" });
    expect(denied.environment.showSystem).not.toHaveBeenCalled();
    expect(denied.environment.addUnread).toHaveBeenCalledOnce();

    const off = fakeEnvironment({
      hidden: true,
      preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, browserNotifications: false },
    });
    createNotifier(off.environment)({ kind: "message", title: "Nova mensagem de Bruno" });
    expect(off.environment.showSystem).not.toHaveBeenCalled();
  });

  it("ignores a notification without a title", () => {
    const fake = fakeEnvironment({ hidden: true });
    createNotifier(fake.environment)({ kind: "call", title: "  " }).close();
    expect(fake.environment.startRing).not.toHaveBeenCalled();
    expect(fake.environment.addUnread).not.toHaveBeenCalled();
  });
});

describe("notifications worker", () => {
  it("is served as JavaScript and only handles notification clicks", async () => {
    const { notificationsWorker } =
      await import("@/features/notifications/server/notifications-worker.server");
    const response = notificationsWorker();
    expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    const source = await response.text();
    expect(source).toContain(`addEventListener("notificationclick"`);
    expect(source).not.toContain(`addEventListener("fetch"`);
  });
});

describe("call end sounds", () => {
  it("are short and quieter than the ring", () => {
    for (const sound of Object.values(CALL_END_SOUNDS)) {
      expect(soundLength(sound.notes)).toBeLessThanOrEqual(0.4);
      expect(sound.volume).toBeLessThan(RING_VOLUME);
    }
  });

  it("falls for nobody answered and clicks once for Recusar", () => {
    const [first, second] = CALL_END_SOUNDS.missed.notes;
    expect(second?.frequency).toBeLessThan(first?.frequency ?? 0);
    expect(CALL_END_SOUNDS.declined.notes).toHaveLength(1);
    expect(soundLength(CALL_END_SOUNDS.declined.notes)).toBeLessThanOrEqual(0.06);
  });
});
