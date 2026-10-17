import type { BadgeTone } from "@/components/StatusBadge";
import type { MailDeliveryStatus } from "./delivery";

export const STATUS_LABELS: Record<MailDeliveryStatus, { label: string; tone: BadgeTone }> = {
  accepted: { label: "Aceito", tone: "success" },
  failed: { label: "Recusado", tone: "danger" },
  not_sent: { label: "Não enviado", tone: "warning" },
};

// Resend codes (https://resend.com/docs/api-reference/errors) and Nodemailer codes.
const REASON_LABELS: Record<string, string> = {
  no_provider: "Nenhum provedor configurado",
  missing_sender: "Falta o remetente",
  invalid_sender: "Remetente em formato inválido",
  validation_error: "Domínio não verificado ou destinatário não permitido",
  invalid_from_address: "Remetente inválido",
  missing_api_key: "Chave do provedor ausente",
  restricted_api_key: "Chave do provedor sem permissão de envio",
  suspended_api_key: "Chave do provedor suspensa",
  invalid_permission: "Chave do provedor sem permissão",
  daily_quota_exceeded: "Limite diário do provedor atingido",
  monthly_quota_exceeded: "Limite mensal do provedor atingido",
  email_above_quota: "Limite do plano do provedor atingido",
  rate_limit_exceeded: "Muitos envios seguidos",
  application_error: "Erro no provedor",
  service_unavailable: "Provedor fora do ar",
  TimeoutError: "O provedor não respondeu a tempo",
  TypeError: "Falha de rede ao falar com o provedor",
  EAUTH: "Usuário ou senha do SMTP recusados",
  ECONNECTION: "Não foi possível conectar ao SMTP",
  ESOCKET: "Não foi possível conectar ao SMTP",
  ENOAUTH: "Faltam usuário e senha do SMTP",
  EPROTOCOL: "O SMTP respondeu de um jeito inesperado",
  ETIMEDOUT: "O SMTP não respondeu a tempo",
  EENVELOPE: "Remetente ou destinatário recusado pelo SMTP",
  EMESSAGE: "Mensagem recusada pelo SMTP",
  ETLS: "Falha na conexão segura com o SMTP",
  EDNS: "Endereço do SMTP não encontrado",
};

const HTTP_STATUS = /^HTTP (\d{3})$/;

/** Plain-Portuguese reason; unknown codes are shown as they came. */
export function reasonLabel(reason: string | null): string {
  if (!reason) return "—";
  const known = REASON_LABELS[reason];
  if (known) return known;
  const http = HTTP_STATUS.exec(reason);
  if (http) return `Recusado pelo provedor: HTTP ${http[1]}`;
  return reason;
}
