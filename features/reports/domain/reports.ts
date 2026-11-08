import type { MessageKind } from "@/features/messages/domain/conversation";

/** Single source for the `reports` enums and their panel labels. */
export const REPORT_TARGET_KINDS = ["user", "message", "conversation"] as const;
export type ReportTargetKind = (typeof REPORT_TARGET_KINDS)[number];

export const REPORT_REASONS = ["spam", "harassment", "hate", "sexual", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "resolved"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_RESOLUTIONS = ["no_action", "message_deleted", "account_blocked"] as const;
export type ReportResolution = (typeof REPORT_RESOLUTIONS)[number];

export const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Assédio ou ofensa",
  hate: "Discurso de ódio",
  sexual: "Conteúdo sexual",
  other: "Outro motivo",
};

export const TARGET_LABELS: Record<ReportTargetKind, string> = {
  user: "Pessoa",
  message: "Mensagem",
  conversation: "Grupo",
};

export const RESOLUTION_LABELS: Record<ReportResolution, string> = {
  no_action: "Resolvida sem ação",
  message_deleted: "Mensagem apagada",
  account_blocked: "Conta bloqueada",
};

export const REPORT_DETAILS_MAX = 500;

/**
 * How a reported message reads in the report's copy and in the panel: its text, the GIF, the
 * name of the file it carries, or "Chamada perdida".
 */
export function reportedMessageText(message: {
  kind: MessageKind;
  body: string | null;
  gifSlug: string | null;
  fileName: string | null;
}): string {
  if (message.kind === "missed_call") return "Chamada perdida";
  if (message.body !== null) return message.body;
  if (message.gifSlug !== null) return `GIF: ${message.gifSlug}`;
  return `Arquivo: ${message.fileName ?? ""}`;
}
