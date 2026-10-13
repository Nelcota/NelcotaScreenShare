import type { NotificationPreferences } from "./preferences";

/** A call rings; a message only counts and, in the background, shows a notification. */
type NotifyKind = "call" | "message";

interface NotifyAction {
  /** Passed back to `onAction` (e.g. "entrar", "recusar"). */
  id: string;
  label: string;
  /** `false` handles it without bringing the tab forward (e.g. "Recusar"). */
  opensApp?: boolean;
}

export interface NotifyOptions {
  kind: NotifyKind;
  /** "Bruno está te chamando", "Nova mensagem de Bruno". */
  title: string;
  /**
   * Shown by the operating system, also while streaming: never the room code or link
   * ("Sala de Bruno" or nothing).
   */
  body?: string;
  /** Same tag replaces the previous notification (one per conversation or call). */
  tag?: string;
  /** Buttons on the system notification, where the browser supports them. */
  actions?: readonly NotifyAction[];
  /** An action id, or "open" when the notification itself is clicked. */
  onAction?: (actionId: string) => void;
}

export interface NotifyHandle {
  /** Stops the ring and removes the system notification (answered, declined, cancelled). */
  close: () => void;
}

export type PermissionState = NotificationPermission | "unsupported";

export interface SystemNotification {
  title: string;
  body?: string;
  tag: string;
  actions: readonly NotifyAction[];
  onAction?: (actionId: string) => void;
}

/** Everything `notify` needs from the browser; tests pass fakes. */
export interface NotifierEnvironment {
  isHidden: () => boolean;
  permission: () => PermissionState;
  preferences: () => NotificationPreferences;
  showSystem: (notification: SystemNotification) => { close: () => void };
  startRing: () => { stop: () => void };
  addUnread: () => void;
  /** Returns a function that cancels the timer. */
  after: (milliseconds: number, run: () => void) => () => void;
}

/** A call that nobody answers stops ringing on its own. */
export const RING_TIMEOUT_MS = 30_000;

const NOOP_HANDLE: NotifyHandle = Object.freeze({ close: () => {} });

/** Our offer only while the browser would still ask, and not in the week after "Agora não". */
export function shouldOfferPermission(
  permission: PermissionState,
  preferences: NotificationPreferences,
  now: number,
): boolean {
  if (permission !== "default") return false;
  if (!preferences.browserNotifications) return false;
  return now >= preferences.promptSnoozedUntil;
}

function canShowSystem(permission: PermissionState, preferences: NotificationPreferences): boolean {
  return permission === "granted" && preferences.browserNotifications;
}

let sequence = 0;

/**
 * `notify` for the calls and messages features. It never asks for the permission: the
 * offer shows with the tab in front (opening Mensagens, the first Chamar) or in /conta.
 */
export function createNotifier(environment: NotifierEnvironment) {
  return function notify(options: NotifyOptions): NotifyHandle {
    if (!options.title.trim()) return NOOP_HANDLE;
    const preferences = environment.preferences();
    const hidden = environment.isHidden();
    if (hidden) environment.addUnread();

    sequence += 1;
    const system =
      hidden && canShowSystem(environment.permission(), preferences)
        ? environment.showSystem({
            title: options.title,
            body: options.body,
            tag: options.tag ?? `nelcota-${options.kind}-${sequence}`,
            actions: options.actions ?? [],
            onAction: options.onAction,
          })
        : undefined;
    const ring =
      options.kind === "call" && preferences.ringSound ? environment.startRing() : undefined;

    let closed = false;
    const cancelTimeout = ring ? environment.after(RING_TIMEOUT_MS, () => ring.stop()) : undefined;
    return {
      close() {
        if (closed) return;
        closed = true;
        cancelTimeout?.();
        ring?.stop();
        system?.close();
      },
    };
  };
}
