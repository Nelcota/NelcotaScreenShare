/** Single source for the `mail_deliveries` enums and the panel labels. */
export const MAIL_DELIVERY_STATUSES = ["accepted", "failed", "not_sent"] as const;
export type MailDeliveryStatus = (typeof MAIL_DELIVERY_STATUSES)[number];

export const MAIL_PROVIDERS = ["resend", "smtp", "none"] as const;
export type MailProvider = (typeof MAIL_PROVIDERS)[number];

/** What the panel can show about one delivery: never the address, the body or a link. */
export interface MailDeliveryOutcome {
  subject: string;
  /** Only the part after the @ (helps spot provider-specific refusals). */
  recipientDomain: string | null;
  provider: MailProvider;
  status: MailDeliveryStatus;
  /** Known provider error code, HTTP status or kind of network failure. */
  reason: string | null;
  attempts: number;
  providerMessageId: string | null;
}

export function recipientDomain(address: string): string | null {
  const at = address.lastIndexOf("@");
  if (at < 0) return null;
  const domain = address
    .slice(at + 1)
    .trim()
    .replace(/>$/, "")
    .toLowerCase();
  if (!domain) return null;
  return domain.slice(0, 255);
}
