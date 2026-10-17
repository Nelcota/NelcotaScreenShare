import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { createTransport, type Transporter } from "nodemailer";
import { getEnv } from "@/server/env.server";
import { logger } from "@/server/logger.server";
import { recordMailDelivery } from "@/server/mail-deliveries.server";
import { currentMailSender } from "@/server/mail-sender.server";
import { recipientDomain, type MailProvider } from "@/features/admin/mail/domain/delivery";
import { isValidSender } from "@/lib/mail-sender";
export { mailLayout } from "@/server/mail-layout.server";

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain text (every e-mail has it; the HTML is optional). */
  text: string;
  html?: string;
}

let transporter: Transporter | undefined;

// https://resend.com/docs/api-reference/errors — never log arbitrary provider text.
const PROVIDER_ERROR_NAMES = new Set([
  "invalid_idempotency_key",
  "validation_error",
  "missing_api_key",
  "restricted_api_key",
  "suspended_api_key",
  "invalid_permission",
  "email_above_quota",
  "not_found",
  "method_not_allowed",
  "concurrent_idempotent_requests",
  "invalid_idempotent_request",
  "resource_locked",
  "invalid_attachment",
  "invalid_parameter",
  "missing_required_field",
  "missing_required_parameter",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "rate_limit_exceeded",
  "application_error",
  "service_unavailable",
  "invalid_from_address",
]);

/** The sender's domain is configuration, safe to log; it must be verified at Resend. */
function senderDomain(sender: string): string | undefined {
  const match = /@([^\s@<>"]+)>?$/.exec(sender);
  return match?.[1];
}

/** Logs a sender that no provider accepts; only its domain reaches the log. */
function senderIsValid(sender: string): boolean {
  if (isValidSender(sender)) return true;
  logger.error(
    { event: "mail.misconfigured", senderDomain: senderDomain(sender) },
    'MAIL_FROM must be "no-reply@domain.com" or "Name <no-reply@domain.com>"',
  );
  return false;
}

/** Called on boot: a bad sender shows up in the log before the first e-mail fails. */
export function checkMailSender(): void {
  const { MAIL_FROM } = getEnv();
  if (!MAIL_FROM) return;
  senderIsValid(MAIL_FROM);
}

function providerMessageId(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || !("id" in result)) return undefined;
  if (typeof result.id !== "string") return undefined;
  return result.id;
}

/**
 * Without a provider, local development reads the links straight from the log. Any other
 * non-production environment (tests, previews) records only the subject: recipients and
 * links with tokens never reach a shared log.
 */
function logUndeliveredMail(message: MailMessage) {
  if (process.env.NODE_ENV !== "development") {
    logger.warn({ mail: { subject: message.subject } }, "e-mail not sent (no provider)");
    return;
  }
  logger.warn(
    { mail: { to: message.to, subject: message.subject }, body: message.text },
    "e-mail not sent (no provider): content in the log",
  );
}

/** The provider's answer; unreadable JSON only costs the message id in the log. */
async function readProviderResult(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    logger.warn(
      { failure: error instanceof Error ? error.name : "unknown", provider: "resend" },
      "e-mail provider answer is not JSON",
    );
    return undefined;
  }
}

/** Only known error codes reach the log; messages may contain recipients or tokens. */
async function providerErrorName(response: Response | undefined): Promise<string | undefined> {
  if (!response) return undefined;
  const result = await readProviderResult(response);
  if (!result || typeof result !== "object" || !("name" in result)) return undefined;
  if (typeof result.name !== "string" || !PROVIDER_ERROR_NAMES.has(result.name)) return undefined;
  return result.name;
}

/** One delivery attempt: the response, or only the kind of network failure. */
async function postToResend(
  headers: Record<string, string>,
  body: string,
): Promise<{ response?: Response; failure?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { response };
  } catch (error) {
    // Network errors can contain private request data: record only their kind.
    return { failure: error instanceof Error ? error.name : "unknown" };
  }
}

/** A delivery the provider did not accept, with only safe details for the history. */
export class MailDeliveryError extends Error {
  readonly reason: string;
  readonly attempts: number;

  constructor(message: string, { reason, attempts }: { reason: string; attempts: number }) {
    super(message);
    this.name = "MailDeliveryError";
    this.reason = reason;
    this.attempts = attempts;
  }
}

interface SentMail {
  attempts: number;
  messageId: string | undefined;
}

function failureReason(status: number | undefined, reason: string | undefined, failure?: string) {
  if (reason) return reason;
  if (status !== undefined) return `HTTP ${status}`;
  return failure ?? "unknown";
}

/** Retries reuse one key, including when a timeout hides an accepted request. */
async function sendWithResend(
  message: MailMessage,
  apiKey: string,
  sender: string,
): Promise<SentMail> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Idempotency-Key": randomUUID(),
  };
  const body = JSON.stringify({ from: sender, ...message });
  const domain = senderDomain(sender);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { response, failure } = await postToResend(headers, body);

    if (response?.ok) {
      const messageId = providerMessageId(await readProviderResult(response));
      logger.info(
        { event: "mail.accepted", provider: "resend", messageId, attempt },
        "e-mail accepted by provider",
      );
      return { attempts: attempt, messageId };
    }

    const status = response?.status;
    const reason = await providerErrorName(response);
    const transient = status === undefined || status === 429 || status >= 500;
    if (!transient || attempt === 3) {
      logger.error(
        {
          event: "mail.failed",
          provider: "resend",
          status,
          failure,
          reason,
          attempt,
          senderDomain: domain,
        },
        "e-mail delivery failed",
      );
      throw new MailDeliveryError(
        status === undefined
          ? "Resend request failed or timed out"
          : `Resend rejected e-mail delivery (HTTP ${status})`,
        { reason: failureReason(status, reason, failure), attempts: attempt },
      );
    }

    logger.warn(
      {
        event: "mail.retry",
        provider: "resend",
        status,
        failure,
        reason,
        attempt,
        senderDomain: domain,
      },
      "retrying e-mail delivery",
    );
    await setTimeout(500 * 2 ** (attempt - 1));
  }
  throw new MailDeliveryError("Resend request failed", { reason: "unknown", attempts: 3 });
}

// Nodemailer error codes are fixed identifiers (EAUTH, ECONNECTION, EENVELOPE…).
const SMTP_ERROR_CODE = /^E[A-Z]{2,20}$/;

function smtpFailureReason(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  if ("code" in error && typeof error.code === "string" && SMTP_ERROR_CODE.test(error.code)) {
    return error.code;
  }
  return error instanceof Error ? error.name : "unknown";
}

async function sendWithSmtp(message: MailMessage, url: string, sender: string | undefined) {
  transporter ??= createTransport(url);
  try {
    const info: unknown = await transporter.sendMail({ from: sender, ...message });
    logger.info({ event: "mail.accepted", provider: "smtp" }, "e-mail accepted by provider");
    const messageId =
      info && typeof info === "object" && "messageId" in info && typeof info.messageId === "string"
        ? info.messageId
        : undefined;
    return { attempts: 1, messageId };
  } catch (error) {
    const reason = smtpFailureReason(error);
    // Only the fixed error code: SMTP messages can carry addresses.
    logger.error({ event: "mail.failed", provider: "smtp", reason }, "e-mail delivery failed");
    throw new MailDeliveryError("SMTP rejected e-mail delivery", { reason, attempts: 1 });
  }
}

type DeliveredBy = Exclude<MailProvider, "none">;

/** Sends through one provider and records the outcome either way. */
async function deliverAndRecord(
  message: MailMessage,
  provider: DeliveredBy,
  send: () => Promise<SentMail>,
): Promise<void> {
  const base = {
    subject: message.subject.slice(0, 200),
    recipientDomain: recipientDomain(message.to),
    provider,
  };
  try {
    const sent = await send();
    await recordMailDelivery({
      ...base,
      status: "accepted",
      reason: null,
      attempts: sent.attempts,
      providerMessageId: sent.messageId?.slice(0, 200) ?? null,
    });
  } catch (error) {
    const failure =
      error instanceof MailDeliveryError
        ? { reason: error.reason.slice(0, 100), attempts: error.attempts }
        : { reason: error instanceof Error ? error.name : "unknown", attempts: 0 };
    await recordMailDelivery({ ...base, status: "failed", providerMessageId: null, ...failure });
    throw error;
  }
}

function missingSender(): never {
  throw new MailDeliveryError("MAIL_FROM is required for Resend delivery", {
    reason: "missing_sender",
    attempts: 0,
  });
}

/**
 * Transactional e-mail. Production failures never log links or recipients.
 * Development without a provider logs the content for local testing.
 * Every attempt leaves a line in `mail_deliveries` for the panel.
 */
function configuredProvider(
  resendKey: string | undefined,
  smtpUrl: string | undefined,
): MailProvider {
  if (resendKey) return "resend";
  if (smtpUrl) return "smtp";
  return "none";
}

/** A malformed MAIL_FROM is refused by every provider: record it instead of trying. */
async function refuseInvalidSender(message: MailMessage, provider: MailProvider): Promise<never> {
  await recordMailDelivery({
    subject: message.subject.slice(0, 200),
    recipientDomain: recipientDomain(message.to),
    provider,
    status: "not_sent",
    reason: "invalid_sender",
    attempts: 0,
    providerMessageId: null,
  });
  throw new MailDeliveryError("MAIL_FROM is not a valid sender address", {
    reason: "invalid_sender",
    attempts: 0,
  });
}

export async function sendMail(message: MailMessage): Promise<void> {
  const { RESEND_API_KEY, SMTP_URL } = getEnv();
  const sender = (await currentMailSender()).value ?? undefined;
  if (sender && !senderIsValid(sender)) {
    await refuseInvalidSender(message, configuredProvider(RESEND_API_KEY, SMTP_URL));
  }
  if (RESEND_API_KEY) {
    await deliverAndRecord(message, "resend", () =>
      sender ? sendWithResend(message, RESEND_API_KEY, sender) : missingSender(),
    );
    return;
  }
  if (SMTP_URL) {
    await deliverAndRecord(message, "smtp", () => sendWithSmtp(message, SMTP_URL, sender));
    return;
  }
  await recordMailDelivery({
    subject: message.subject.slice(0, 200),
    recipientDomain: recipientDomain(message.to),
    provider: "none",
    status: "not_sent",
    reason: "no_provider",
    attempts: 0,
    providerMessageId: null,
  });
  if (process.env.NODE_ENV === "production") {
    throw new Error("E-mail delivery is not configured");
  }
  logUndeliveredMail(message);
}
