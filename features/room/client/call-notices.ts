import type { ReactNode } from "react";
import { toast, type ExternalToast } from "sonner";

/** The call's own toaster (top right, under the top bar); see CallToaster. */
export const CALL_TOASTER_ID = "call";

const CALL_NOTICE_MS = 3000;

/**
 * A short room notice ("Bia entrou", "Ana: oi"): a one-line pill that clicks pass through,
 * so it never gets in the way of the call. Notices with an action go elsewhere.
 */
export function showCallNotice(
  message: string,
  options: Pick<ExternalToast, "id" | "onDismiss" | "onAutoClose"> = {},
) {
  toast(message, {
    ...options,
    toasterId: CALL_TOASTER_ID,
    duration: CALL_NOTICE_MS,
    className: "pointer-events-none",
  });
}

// Whether the call's toaster is on screen (not while the call is minimized on another page).
let callToasterShown = false;

/** CallToaster says when it appears and goes. */
export function setCallToasterShown(shown: boolean) {
  callToasterShown = shown;
}

/**
 * The call's messages follow the room's notices: on the call's toaster while it shows, and
 * clicks pass through unless there is a button to press ("Tentar de novo").
 */
function inCall(options: ExternalToast = {}): ExternalToast {
  const clickable = Boolean(options.action ?? options.cancel);
  return {
    ...options,
    toasterId: callToasterShown ? CALL_TOASTER_ID : undefined,
    className: [options.className, clickable ? undefined : "pointer-events-none"]
      .filter(Boolean)
      .join(" "),
  };
}

type Message = string | ReactNode;

/** sonner's `toast`, for code that runs inside the call. */
export const callToast = Object.assign(
  (message: Message, options?: ExternalToast) => toast(message, inCall(options)),
  {
    error: (message: Message, options?: ExternalToast) => toast.error(message, inCall(options)),
    info: (message: Message, options?: ExternalToast) => toast.info(message, inCall(options)),
    success: (message: Message, options?: ExternalToast) => toast.success(message, inCall(options)),
    warning: (message: Message, options?: ExternalToast) => toast.warning(message, inCall(options)),
    dismiss: (id?: string | number) => toast.dismiss(id),
  },
);
