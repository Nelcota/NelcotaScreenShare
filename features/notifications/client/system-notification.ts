import type { SystemNotification } from "@/features/notifications/domain/notifier";
import { logBrowserWarning } from "@/lib/telemetry.client";

const WORKER_URL = "/notifications-sw.js";
const MESSAGE_TYPE = "nelcota-notification";
const ICON = "/icon.png";

/** Who handles each notification's clicks, by tag. */
const handlers = new Map<string, (actionId: string) => void>();
let registration: Promise<ServiceWorkerRegistration | undefined> | undefined;

function field(data: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(data, key)?.value;
}

/** A click relayed by the worker: its notification's tag and the action id. */
function notificationClick(data: unknown): { tag: string; action: string } | undefined {
  if (!data || typeof data !== "object") return undefined;
  if (field(data, "type") !== MESSAGE_TYPE) return undefined;
  const tag = field(data, "tag");
  const action = field(data, "action");
  if (typeof tag !== "string" || typeof action !== "string") return undefined;
  return { tag, action };
}

function handleWorkerMessage(event: MessageEvent) {
  const click = notificationClick(event.data);
  if (!click) return;
  const handler = handlers.get(click.tag);
  handlers.delete(click.tag);
  handler?.(click.action);
}

/** The worker gives notifications buttons; without it (or on failure) they have none. */
function notificationWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) return Promise.resolve(undefined);
  registration ??= (async () => {
    try {
      navigator.serviceWorker.addEventListener("message", handleWorkerMessage);
      await navigator.serviceWorker.register(WORKER_URL);
      return await navigator.serviceWorker.ready;
    } catch (error) {
      logBrowserWarning("Could not register the notifications worker", error);
      return undefined;
    }
  })();
  return registration;
}

/** Registers the worker ahead of time, once the permission exists. */
export function prepareSystemNotifications() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  void notificationWorker();
}

function showWithoutWorker(notification: SystemNotification): () => void {
  const shown = new Notification(notification.title, {
    body: notification.body,
    tag: notification.tag,
    icon: ICON,
  });
  shown.addEventListener("click", () => {
    window.focus();
    shown.close();
    notification.onAction?.("open");
  });
  return () => shown.close();
}

async function showWithWorker(
  worker: ServiceWorkerRegistration,
  notification: SystemNotification,
): Promise<() => void> {
  const background = notification.actions
    .filter((action) => action.opensApp === false)
    .map((action) => action.id);
  // `actions` is not in every TypeScript DOM version yet; browsers without it ignore it.
  const options: NotificationOptions & { actions: { action: string; title: string }[] } = {
    body: notification.body,
    tag: notification.tag,
    icon: ICON,
    data: { background },
    actions: notification.actions.map((action) => ({ action: action.id, title: action.label })),
  };
  if (notification.onAction) handlers.set(notification.tag, notification.onAction);
  await worker.showNotification(notification.title, options);
  return () => {
    handlers.delete(notification.tag);
    void worker
      .getNotifications({ tag: notification.tag })
      .then((shown) => shown.forEach((item) => item.close()));
  };
}

/** Shows it as soon as the worker answers; `close` works before or after that. */
export function showSystemNotification(notification: SystemNotification): { close: () => void } {
  let closed = false;
  let closeShown: (() => void) | undefined;
  void (async () => {
    try {
      const worker = await notificationWorker();
      if (closed) return;
      closeShown = worker
        ? await showWithWorker(worker, notification)
        : showWithoutWorker(notification);
      if (closed) closeShown();
    } catch (error) {
      logBrowserWarning("Could not show a system notification", error);
    }
  })();
  return {
    close() {
      closed = true;
      closeShown?.();
    },
  };
}
