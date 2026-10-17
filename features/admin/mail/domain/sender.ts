import { z } from "zod";
import { isValidSender } from "@/lib/mail-sender";

/** The `app_settings` row that holds the sender typed in the panel. */
export const MAIL_SENDER_SETTING_KEY = "mail";
export const MAX_SENDER_LENGTH = 200;

const SENDER_FORMAT_MESSAGE = "Use Nome <email@dominio> ou só o e-mail.";

/** A blank field means "use the hosting's MAIL_FROM". */
function blankToNull(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed;
}

/** What the panel saves: a sender the providers accept, or null to fall back to MAIL_FROM. */
export const mailSenderSchema = z.object({
  sender: z.preprocess(
    blankToNull,
    z
      .string()
      .max(MAX_SENDER_LENGTH, SENDER_FORMAT_MESSAGE)
      .refine(isValidSender, SENDER_FORMAT_MESSAGE)
      .nullable(),
  ),
});

export type MailSenderSettings = z.infer<typeof mailSenderSchema>;

export const MAIL_SENDER_DEFAULTS: MailSenderSettings = { sender: null };

export interface MailSender {
  /** The address e-mails go out from, or null when there is none anywhere. */
  value: string | null;
  /** True when it came from the panel; false when it is the hosting's MAIL_FROM. */
  fromPanel: boolean;
}

/** The panel's sender wins; without one, the hosting's MAIL_FROM still applies. */
export function effectiveSender(
  saved: MailSenderSettings,
  hosting: string | undefined,
): MailSender {
  if (saved.sender) return { value: saved.sender, fromPanel: true };
  return { value: hosting ?? null, fromPanel: false };
}
