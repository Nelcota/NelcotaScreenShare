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
